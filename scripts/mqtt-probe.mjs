// MQTT probe harness for the Carlo Gavazzi CG-UWP40 gateway.
//
// Sends a command to each function on `.../cmd/ot` and captures the raw echo on
// `.../metrics`, so we can see the actual value TYPE (integer vs float), scale,
// and the per-signal `type` field for every sensor / actuator / function.
//
// The app stores broker credentials in device storage, so pass them here via
// env vars (or a real broker URL):
//
//   MQTT_URL=mqtt://10.0.0.5:1883 \
//   MQTT_USERNAME=user MQTT_PASSWORD=pass \
//   node scripts/mqtt-probe.mjs pressurePump1 pressurePump2
//
// Or piecewise: MQTT_HOST, MQTT_PORT (default 1883), MQTT_CLIENT_ID.
// Override the topic base with MQTT_TOPIC_ROOT if the site path differs.
//
// Usage:
//   node scripts/mqtt-probe.mjs                 # list probes + usage
//   node scripts/mqtt-probe.mjs observe [secs]  # subscribe only, dump metrics
//   node scripts/mqtt-probe.mjs all             # run every write-enabled probe
//   node scripts/mqtt-probe.mjs pressurePump1   # run selected probe(s) by key

import mqtt from 'mqtt';

const TOPIC_ROOT =
  process.env.MQTT_TOPIC_ROOT || 'epbox/imox/demo/site/batam/edge/cg-uwp40-01';
const METRICS_TOPIC = `${TOPIC_ROOT}/metrics`;
const CMD_TOPIC = `${TOPIC_ROOT}/cmd/ot`;

const ECHO_TIMEOUT_MS = Number(process.env.MQTT_ECHO_TIMEOUT_MS || 8000);

// Each probe: what to write, which device to watch echo on. `write:false` means
// observe-only (stateful/risky functions we don't want to blindly toggle).
const PROBES = [
  {
    key: 'pressurePump1',
    label: 'Pressure Transmitter - Pump 1 (PT-001)',
    deviceId: 6983,
    write: true,
    build: (v) => ({ id: 6983, cmd: 'SetValue', value: v }),
    testValue: 12.3, // deliberately fractional — reveals int-vs-float behavior
  },
  {
    key: 'pressurePump2',
    label: 'Pressure Transmitter - Pump 2 (PT-002)',
    deviceId: 7019,
    write: true,
    build: (v) => ({ id: 7019, cmd: 'SetValue', value: v }),
    testValue: 8.7,
  },
  {
    key: 'temperature',
    label: 'Accommodation Temperature',
    deviceId: 3585,
    write: true,
    build: (v) => ({ id: 3585, cmd: 'SetValue', value: v }),
    testValue: 47,
  },
  {
    key: 'smokeStatus',
    label: 'Smoke Status',
    deviceId: 3549,
    write: true,
    build: (v) => ({ id: 3549, cmd: 'SetValue', value: v }),
    testValue: 1,
  },
  {
    key: 'plcFromDo',
    label: 'FROM PLC - SIEMENS (DO status, read-only)',
    deviceId: 6563,
    write: false, // 6563 is the PLC's DO output status — read-only, never written
    build: () => null, // observe only
  },
  {
    key: 'plcToPlc',
    label: 'TO PLC - SIEMENS (packed PT1 + PT2 + Pump Activation)',
    deviceId: 7193,
    write: true,
    // Packed uint64: W0=PT1 counter, W1=PT2 counter, W2=Pump Activation, W3=spare.
    // Counters are the pressure set-point in BAR × 10 (bar = mA − 4).
    // Test value: PT1=123 (12.3 bar), PT2=87 (8.7 bar), Pump Activation=1.
    build: (v) => ({ id: 7193, cmd: 'SetValue', value: v }),
    testValue: 123 + 87 * 2 ** 16 + 1 * 2 ** 32,
  },
  {
    key: 'alarm',
    label: 'Alarm (Acknowledgement)',
    deviceId: 3667,
    write: false,
    build: () => ({ id: 3667, cmd: 'Acknowledgement' }),
  },
  {
    key: 'zoneTemperature',
    label: 'Zone Temperature',
    deviceId: 4147,
    write: false,
    build: () => null, // observe only
  },
];

function describeValue(value) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'number') {
    return `${value} (number, ${Number.isInteger(value) ? 'int' : 'float'})`;
  }
  if (type === 'string') return `${JSON.stringify(value)} (string)`;
  return `${JSON.stringify(value)} (${type})`;
}

function findDevice(payload, deviceId) {
  if (!payload || !Array.isArray(payload.devices)) return null;
  return payload.devices.find((d) => d.id === deviceId) ?? null;
}

function dumpDevice(device) {
  if (!device) {
    console.log('    (device not present in metrics)');
    return;
  }
  console.log(`    device ${device.id} "${device.name}" pn=${device.pn ?? '-'}`);
  for (const sig of device.signals ?? []) {
    console.log(
      `      • id=${sig.id} type=${sig.type} unit=${JSON.stringify(sig.unit)} ` +
        `name=${JSON.stringify(sig.name)} value=${describeValue(sig.value)}`
    );
  }
}

function connect() {
  const url =
    process.env.MQTT_URL ||
    `mqtt://${process.env.MQTT_HOST || 'localhost'}:${process.env.MQTT_PORT || 1883}`;
  console.log(`Connecting to ${url} …`);
  const client = mqtt.connect(url, {
    clientId: process.env.MQTT_CLIENT_ID || `epbox-probe-${Date.now()}`,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    connectTimeout: 20_000,
    reconnectPeriod: 0,
    clean: true,
    protocolVersion: 4,
  });
  return { client, url };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function main() {
  const args = process.argv.slice(2);
  const mode = args[0];

  if (!mode) {
    console.log('CG-UWP40 MQTT probe. Available probe keys:');
    for (const p of PROBES) {
      console.log(`  - ${p.key.padEnd(16)} ${p.label}${p.write ? '' : '  (observe only)'}`);
    }
    console.log('\nExamples:');
    console.log('  node scripts/mqtt-probe.mjs observe 20');
    console.log('  node scripts/mqtt-probe.mjs all');
    console.log('  node scripts/mqtt-probe.mjs pressurePump1 pressurePump2');
    console.log('\nSet MQTT_URL (or MQTT_HOST/MQTT_PORT) + MQTT_USERNAME/MQTT_PASSWORD.');
    process.exit(0);
  }

  const { client } = connect();
  let latestMetrics = null;
  let latestMetricsAt = 0;

  client.on('message', (topic, buf) => {
    if (topic !== METRICS_TOPIC) return;
    try {
      latestMetrics = JSON.parse(buf.toString());
      latestMetricsAt = Date.now();
    } catch (e) {
      console.error('  ! failed to parse metrics:', e.message);
    }
  });

  client.on('error', (e) => {
    console.error('MQTT error:', e.message);
  });

  client.on('connect', async () => {
    console.log('Connected. Subscribing to metrics…\n');
    client.subscribe(METRICS_TOPIC, { qos: 0 }, async (err) => {
      if (err) {
        console.error('Subscribe failed:', err.message);
        client.end(true);
        process.exit(1);
      }

      if (mode === 'observe') {
        const secs = Number(args[1] || 15);
        console.log(`Observing ${METRICS_TOPIC} for ${secs}s…\n`);
        const seen = new Set(PROBES.map((p) => p.deviceId));
        const stop = Date.now() + secs * 1000;
        while (Date.now() < stop) {
          await sleep(1000);
          if (!latestMetrics) continue;
          console.log(`— metrics @ ${new Date(latestMetricsAt).toISOString()}`);
          for (const id of seen) dumpDevice(findDevice(latestMetrics, id));
          console.log('');
          latestMetrics = null;
        }
        client.end(true);
        process.exit(0);
      }

      const selected =
        mode === 'all'
          ? PROBES.filter((p) => p.write)
          : PROBES.filter((p) => args.includes(p.key));

      if (selected.length === 0) {
        console.error(`No matching probe for: ${args.join(', ')}`);
        client.end(true);
        process.exit(1);
      }

      // Let one metrics snapshot land as baseline.
      console.log('Waiting for baseline metrics…');
      const baselineStop = Date.now() + ECHO_TIMEOUT_MS;
      while (!latestMetrics && Date.now() < baselineStop) await sleep(200);
      console.log(latestMetrics ? 'Baseline received.\n' : 'No baseline yet — continuing.\n');

      for (const probe of selected) {
        console.log(`══ ${probe.key} — ${probe.label} (device ${probe.deviceId})`);
        const baselineDevice = findDevice(latestMetrics, probe.deviceId);
        console.log('  baseline:');
        dumpDevice(baselineDevice);

        const payload = probe.build(probe.testValue);
        if (!payload) {
          console.log('  (observe-only probe — no command sent)\n');
          continue;
        }

        const sentAt = Date.now();
        console.log(`  → publish ${CMD_TOPIC}: ${JSON.stringify(payload)}`);
        await new Promise((resolve) =>
          client.publish(CMD_TOPIC, JSON.stringify(payload), { qos: 0, retain: false }, resolve)
        );

        // Wait for a metrics message that arrived after our publish.
        const deadline = sentAt + ECHO_TIMEOUT_MS;
        let echoed = null;
        while (Date.now() < deadline) {
          await sleep(200);
          if (latestMetricsAt > sentAt) {
            echoed = findDevice(latestMetrics, probe.deviceId);
            if (echoed) break;
          }
        }

        const rtt = Date.now() - sentAt;
        if (echoed) {
          console.log(`  ← echo after ${rtt}ms:`);
          dumpDevice(echoed);
        } else {
          console.log(`  ← no echo within ${ECHO_TIMEOUT_MS}ms.`);
        }
        console.log('');
      }

      console.log('Done.');
      client.end(true);
      process.exit(0);
    });
  });
}

main();
