import { Slider } from '@expo/ui/community/slider';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_PUMP_ROOM_PLC_INPUTS,
  getStoredPumpRoomPlcInputs,
  PUMP_ROOM_PLC_FIELDS,
  setStoredPumpRoomPlcInputs,
  type PumpRoomPlcInputKey,
  type PumpRoomPlcInputs,
} from '@/lib/pump-room-demo';
import { AppColors } from '@/styles';
import { getSignalPalette, styles, type SignalTone } from '@/styles/screens/station.styles';

// Sensor field constants keep all UI limits and steps in one place.
const PRESSURE_MIN_BAR = 0;
const PRESSURE_WARNING_BAR = 7.5;
const PRESSURE_DANGER_BAR = 10.2;
const PRESSURE_SLIDER_MAX_BAR = 16;
const FLOW_RATE_FIELD_KEY: PumpRoomPlcInputKey = 'dischargeFlowRate';
const FLOW_RATE_MIN_M3H = 0;
const FLOW_RATE_STEP_M3H = 1;
const AMPERE_MIN_A = 0;
const AMPERE_MAX_A = 160;
const AMPERE_STEP_A = 1;
const DASHBOARD_STATUS_OPTIONS = [
  { value: 0, label: 'Off', icon: 'power' },
  { value: 1, label: 'Running', icon: 'activity' },
  { value: 2, label: 'Tripped', icon: 'alert-triangle' },
] as const;

// Shared type aliases keep the component props close to the screen data model.
type PumpRoomField = (typeof PUMP_ROOM_PLC_FIELDS)[number];
type FieldUpdater = (key: PumpRoomPlcInputKey, value: string) => void;
type FlowRateStepper = (delta: number) => void;
type DashboardStatusCode = (typeof DASHBOARD_STATUS_OPTIONS)[number]['value'];
type StepperChipTone = 'default' | 'stable' | 'warning' | 'danger';
type PumpRoomDashboardInputs = {
  temperatureAlarm: boolean;
  currentStatus: DashboardStatusCode;
  ampereStatus: string;
  pressurePump1: string;
  pressurePump2: string;
  dischargeFlowRate: string;
};

// Dashboard defaults are editable values, not formatted display strings.
const DEFAULT_DASHBOARD_INPUTS: PumpRoomDashboardInputs = {
  temperatureAlarm: true,
  currentStatus: 1,
  ampereStatus: '76',
  pressurePump1: '7.4',
  pressurePump2: '7.1',
  dischargeFlowRate: '168',
};

// Pressure value helpers parse, clamp, and format bar values for the slider.
function clampPressureValue(value: number) {
  if (!Number.isFinite(value)) {
    return PRESSURE_MIN_BAR;
  }

  return Math.min(Math.max(value, PRESSURE_MIN_BAR), PRESSURE_SLIDER_MAX_BAR);
}

function parsePressureValue(value: string) {
  const parsedValue = Number.parseFloat(value.replace(',', '.'));

  return clampPressureValue(parsedValue);
}

function formatPressureValue(value: number) {
  return `${clampPressureValue(value).toFixed(1)} bar`;
}

// Flow rate helpers keep the number input stored as the existing m3/h string.
function clampFlowRateValue(value: number) {
  if (!Number.isFinite(value)) {
    return FLOW_RATE_MIN_M3H;
  }

  return Math.max(Math.round(value), FLOW_RATE_MIN_M3H);
}

function parseFlowRateValue(value: string) {
  const leadingNumberMatch = value.trim().match(/^\d+/);
  const parsedValue = leadingNumberMatch ? Number.parseInt(leadingNumberMatch[0], 10) : Number.NaN;

  return clampFlowRateValue(parsedValue);
}

function formatFlowRateValue(value: number) {
  return `${clampFlowRateValue(value)} m3/h`;
}

function clampAmpereValue(value: number) {
  if (!Number.isFinite(value)) {
    return AMPERE_MIN_A;
  }

  return Math.min(Math.max(Math.round(value), AMPERE_MIN_A), AMPERE_MAX_A);
}

function parseAmpereValue(value: string) {
  const leadingNumberMatch = value.trim().match(/^\d+/);
  const parsedValue = leadingNumberMatch ? Number.parseInt(leadingNumberMatch[0], 10) : Number.NaN;

  return clampAmpereValue(parsedValue);
}

function formatAmpereValue(value: number) {
  return String(clampAmpereValue(value));
}

// Dashboard float helpers keep decimal inputs numeric while allowing in-progress typing.
function getLeadingDecimalString(value: string) {
  const leadingDecimalMatch = value.trim().match(/^\d+(?:[.,]\d+)?/);

  return leadingDecimalMatch ? leadingDecimalMatch[0].replace(',', '.') : '0';
}

function formatDashboardPressureValue(value: number) {
  return clampPressureValue(value).toFixed(1);
}

function getPressureSignalTone(value: number): SignalTone {
  if (value >= PRESSURE_DANGER_BAR) {
    return 'danger';
  }

  if (value >= PRESSURE_WARNING_BAR) {
    return 'warning';
  }

  return 'normal';
}

function getPressureSignalLabel(tone: SignalTone) {
  if (tone === 'danger') {
    return `Danger >= ${PRESSURE_DANGER_BAR.toFixed(1)} bar`;
  }

  if (tone === 'warning') {
    return `Watch >= ${PRESSURE_WARNING_BAR.toFixed(1)} bar`;
  }

  return 'Normal range';
}

function createDashboardInputsFromPlcInputs(inputs: PumpRoomPlcInputs): PumpRoomDashboardInputs {
  return {
    ...DEFAULT_DASHBOARD_INPUTS,
    pressurePump1: getLeadingDecimalString(inputs.pressurePump1),
    pressurePump2: getLeadingDecimalString(inputs.pressurePump2),
    dischargeFlowRate: String(parseFlowRateValue(inputs.dischargeFlowRate)),
  };
}

// The header block owns route navigation and screen identity.
function PumpRoomHeader() {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.navigate('/explore')}>
        <Feather name="arrow-left" size={24} color={AppColors.text} />
      </TouchableOpacity>
      <Text style={styles.headerLabel}>Pump Room</Text>
      <View style={styles.headerGhost} />
    </View>
  );
}

// The hero block gives the room status and a short calibration summary.
function PumpRoomHero() {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroBadge}>
          <MaterialCommunityIcons name="fire-hydrant" size={14} color={AppColors.primary} />
          <Text style={styles.heroBadgeText}>Pump Room</Text>
        </View>
        <View style={styles.liveChip}>
          <View style={[styles.liveDot, styles.plcDot]} />
          <Text style={styles.liveChipText}>Active</Text>
        </View>
      </View>
      <Text style={styles.heroSubtitle}>
        Please calibrate the sensors and actuators to match reference parameters.
      </Text>
    </View>
  );
}

function EngineeringSignalBands({ tone }: { tone: SignalTone }) {
  return (
    <View style={styles.signalBandsRow}>
      <View
        style={[
          styles.signalBand,
          styles.signalBandNormal,
          tone === 'normal' && styles.signalBandActive,
        ]}
      />
      <View
        style={[
          styles.signalBand,
          styles.signalBandWarning,
          tone === 'warning' && styles.signalBandActive,
        ]}
      />
      <View
        style={[
          styles.signalBand,
          styles.signalBandDanger,
          tone === 'danger' && styles.signalBandActive,
        ]}
      />
    </View>
  );
}

// Pressure transmitter fields render as sliders with a danger indicator.
function PressureTransmitterField({
  field,
  value,
  onChange,
}: {
  field: PumpRoomField;
  value: string;
  onChange: FieldUpdater;
}) {
  const pressureValue = parsePressureValue(value);
  const signalTone = getPressureSignalTone(pressureValue);
  const signalPalette = getSignalPalette(signalTone);

  return (
    <View style={styles.fieldBlock}>
      <View style={styles.fieldHeaderRow}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        <View
          style={[
            styles.signalValueChip,
            {
              backgroundColor: signalPalette.surface,
              borderColor: signalPalette.border,
            },
          ]}>
          <View
            style={[
              styles.signalValueDot,
              { backgroundColor: signalPalette.accent },
            ]}
          />
          <Text
            style={[
              styles.signalValueText,
              { color: signalPalette.text },
            ]}>
            {formatPressureValue(pressureValue)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.signalSliderShell,
          signalTone === 'normal' && styles.signalSliderShellNormal,
          signalTone === 'warning' && styles.signalSliderShellWarning,
          signalTone === 'danger' && styles.signalSliderShellDanger,
        ]}>
        <Slider
          value={pressureValue}
          minimumValue={PRESSURE_MIN_BAR}
          maximumValue={PRESSURE_SLIDER_MAX_BAR}
          step={0.1}
          minimumTrackTintColor={signalPalette.accent}
          maximumTrackTintColor={signalPalette.track}
          thumbTintColor={signalPalette.accent}
          onValueChange={(nextValue) => onChange(field.key, formatPressureValue(nextValue))}
          style={styles.pressureSlider}
        />

        <EngineeringSignalBands tone={signalTone} />
      </View>

      <View style={styles.sliderRangeRow}>
        <Text style={styles.sliderRangeText}>0 bar</Text>
        <View
          style={[
            styles.signalStateBadge,
            {
              backgroundColor: signalPalette.surface,
              borderColor: signalPalette.border,
            },
          ]}>
          <Text
            style={[
              styles.signalStateText,
              { color: signalPalette.text },
            ]}>
            {getPressureSignalLabel(signalTone)}
          </Text>
        </View>
        <Text style={styles.sliderRangeText}>16 bar</Text>
      </View>
    </View>
  );
}

// Flow rate field renders as a number input with minus and plus steppers.
function FlowRateField({
  field,
  value,
  onStep,
}: {
  field: PumpRoomField;
  value: string;
  onStep: FlowRateStepper;
}) {
  const flowRateValue = parseFlowRateValue(value);
  const isMinimumFlowRate = flowRateValue <= FLOW_RATE_MIN_M3H;

  return (
    <View style={styles.fieldBlock}>
      <View style={styles.dashboardControlCard}>
        <PanelStepperField
          label={field.label}
          value={String(flowRateValue)}
          unit="m3/h"
          chipText={`${flowRateValue} m3/h`}
          chipTone={flowRateValue > 0 ? 'stable' : 'default'}
          hint="Discharge reference for calibration channel."
          onStep={(delta) => onStep(delta * FLOW_RATE_STEP_M3H)}
          isMinimumDisabled={isMinimumFlowRate}
        />
      </View>
    </View>
  );
}

// The sensor calibration block chooses the right control for each PLC field.
function SensorCalibrationSection({
  form,
  onChange,
  onFlowRateStep,
}: {
  form: PumpRoomPlcInputs;
  onChange: FieldUpdater;
  onFlowRateStep: FlowRateStepper;
}) {
  return (
    <View style={styles.sectionCard}>
      {PUMP_ROOM_PLC_FIELDS.map((field) => {
        if (field.key === FLOW_RATE_FIELD_KEY) {
          return (
            <FlowRateField
              key={field.key}
              field={field}
              value={form[field.key]}
              onStep={onFlowRateStep}
            />
          );
        }

        return (
          <PressureTransmitterField
            key={field.key}
            field={field}
            value={form[field.key]}
            onChange={onChange}
          />
        );
      })}
    </View>
  );
}

// Dashboard boolean input maps temperature zone alarm to true or false.
function DashboardAlarmField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardToggleRow}>
        <View>
          <Text style={styles.fieldLabel}>Temp Zone (Alarm)</Text>
          <Text style={styles.dashboardToggleValue}>{value ? 'Alarm' : 'Normal'}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => onChange(!value)}
          accessibilityRole="switch"
          accessibilityState={{ checked: value }}
          accessibilityLabel="Temperature zone alarm"
          style={[
            styles.alarmToggle,
            value ? styles.alarmToggleActive : styles.alarmToggleInactive,
          ]}>
          <View
            style={[
              styles.alarmToggleThumb,
              value ? styles.alarmToggleThumbActive : styles.alarmToggleThumbInactive,
            ]}>
            <Feather
              name={value ? 'alert-triangle' : 'check'}
              size={14}
              color={value ? AppColors.error : AppColors.success}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStatusPanelAccent(value: DashboardStatusCode) {
  if (value === 1) {
    return {
      fill: AppColors.surfaceSuccess,
      border: '#9BD7B6',
      icon: AppColors.success,
      lamp: AppColors.success,
    };
  }

  if (value === 2) {
    return {
      fill: AppColors.surfaceError,
      border: '#F6B1B1',
      icon: AppColors.error,
      lamp: AppColors.error,
    };
  }

  return {
    fill: AppColors.surfaceMuted,
    border: AppColors.border,
    icon: AppColors.textSubtle,
    lamp: AppColors.textSubtle,
  };
}

function getStepperChipToneStyles(tone: StepperChipTone) {
  if (tone === 'stable') {
    return {
      container: styles.dashboardValueChipStable,
      text: styles.dashboardValueChipTextStable,
    };
  }

  if (tone === 'warning') {
    return {
      container: styles.dashboardValueChipWarning,
      text: styles.dashboardValueChipTextWarning,
    };
  }

  if (tone === 'danger') {
    return {
      container: styles.dashboardValueChipDanger,
      text: styles.dashboardValueChipTextDanger,
    };
  }

  return {
    container: undefined,
    text: undefined,
  };
}

// Dashboard status input maps operational status codes to panel-style selectors.
function DashboardStatusField({
  value,
  onChange,
}: {
  value: DashboardStatusCode;
  onChange: (value: DashboardStatusCode) => void;
}) {
  return (
    <View style={styles.dashboardFieldBlock}>
      <Text style={styles.fieldLabel}>Current Status</Text>
      <View style={styles.statusSegmentRow}>
        {DASHBOARD_STATUS_OPTIONS.map((option) => {
          const isActive = option.value === value;
          const accent = getStatusPanelAccent(option.value);

          return (
            <TouchableOpacity
              key={option.value}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Set current status to ${option.label}`}
              style={[
                styles.statusSegmentButton,
                isActive && styles.statusSegmentButtonActive,
                isActive && {
                  backgroundColor: accent.fill,
                  borderColor: accent.border,
                },
              ]}
              onPress={() => onChange(option.value)}>
              <View style={styles.statusSegmentTopRow}>
                <View
                  style={[
                    styles.statusSegmentLamp,
                    { backgroundColor: accent.lamp },
                    isActive && styles.statusSegmentLampActive,
                  ]}
                />
                <Text style={styles.statusSegmentCode}>
                  {String(option.value).padStart(2, '0')}
                </Text>
              </View>

              <View
                style={[
                  styles.statusSegmentCap,
                  isActive && styles.statusSegmentCapActive,
                ]}>
                <Feather
                  name={option.icon}
                  size={18}
                  color={isActive ? accent.icon : AppColors.textSubtle}
                />
              </View>

              <Text
                style={[
                  styles.statusSegmentText,
                  isActive && styles.statusSegmentTextActive,
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function PanelStepperField({
  label,
  value,
  unit,
  chipText,
  chipTone = 'default',
  hint,
  onStep,
  isMinimumDisabled,
  isMaximumDisabled = false,
}: {
  label: string;
  value: string;
  unit: string;
  chipText: string;
  chipTone?: StepperChipTone;
  hint?: string;
  onStep: (delta: number) => void;
  isMinimumDisabled: boolean;
  isMaximumDisabled?: boolean;
}) {
  const chipStyles = getStepperChipToneStyles(chipTone);

  return (
    <>
      <View style={styles.dashboardControlHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View
          style={[
            styles.dashboardValueChip,
            chipStyles.container,
          ]}>
          <Text
            style={[
              styles.dashboardValueChipText,
              chipStyles.text,
            ]}>
            {chipText}
          </Text>
        </View>
      </View>

      <View style={styles.dashboardStepperRow}>
        <TouchableOpacity
          style={[
            styles.dashboardStepperButton,
            isMinimumDisabled && styles.stepperButtonDisabled,
          ]}
          onPress={() => onStep(-1)}
          disabled={isMinimumDisabled}>
          <Feather
            name="minus"
            size={18}
            color={isMinimumDisabled ? AppColors.textSubtle : AppColors.text}
          />
        </TouchableOpacity>

        <View style={styles.dashboardReadoutShell}>
          <Text style={styles.dashboardReadoutValue}>{value}</Text>
          <Text style={styles.dashboardReadoutUnit}>{unit}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.dashboardStepperButton,
            isMaximumDisabled && styles.stepperButtonDisabled,
          ]}
          onPress={() => onStep(1)}
          disabled={isMaximumDisabled}>
          <Feather
            name="plus"
            size={18}
            color={isMaximumDisabled ? AppColors.textSubtle : AppColors.text}
          />
        </TouchableOpacity>
      </View>

      {hint ? <Text style={styles.dashboardControlHint}>{hint}</Text> : null}
    </>
  );
}

function DashboardAmpereField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ampereValue = parseAmpereValue(value);
  const isCriticalAmpere = ampereValue >= 140;
  const isHighAmpere = ampereValue >= 100;
  const isMinimumAmpere = ampereValue <= AMPERE_MIN_A;
  const isMaximumAmpere = ampereValue >= AMPERE_MAX_A;

  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardControlCard}>
        <PanelStepperField
          label="Ampere Status"
          value={String(ampereValue)}
          unit="A"
          chipText={`${ampereValue} A`}
          chipTone={isCriticalAmpere ? 'danger' : isHighAmpere ? 'warning' : 'default'}
          hint="Current draw reference for dashboard panel."
          onStep={(delta) => onChange(formatAmpereValue(ampereValue + delta * AMPERE_STEP_A))}
          isMinimumDisabled={isMinimumAmpere}
          isMaximumDisabled={isMaximumAmpere}
        />
      </View>
    </View>
  );
}

function DashboardPressureField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const pressureValue = parsePressureValue(value);
  const signalTone = getPressureSignalTone(pressureValue);
  const signalPalette = getSignalPalette(signalTone);

  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardControlCard}>
        <View style={styles.dashboardControlHeader}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View
            style={[
              styles.signalValueChip,
              {
                backgroundColor: signalPalette.surface,
                borderColor: signalPalette.border,
              },
            ]}>
            <View
              style={[
                styles.signalValueDot,
                { backgroundColor: signalPalette.accent },
              ]}
            />
            <Text
              style={[
                styles.signalValueText,
                { color: signalPalette.text },
              ]}>
              {pressureValue.toFixed(1)} bar
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.signalSliderShell,
            signalTone === 'normal' && styles.signalSliderShellNormal,
            signalTone === 'warning' && styles.signalSliderShellWarning,
            signalTone === 'danger' && styles.signalSliderShellDanger,
          ]}>
          <Slider
            value={pressureValue}
            minimumValue={PRESSURE_MIN_BAR}
            maximumValue={PRESSURE_SLIDER_MAX_BAR}
            step={0.1}
            minimumTrackTintColor={signalPalette.accent}
            maximumTrackTintColor={signalPalette.track}
            thumbTintColor={signalPalette.accent}
            onValueChange={(nextValue) => onChange(formatDashboardPressureValue(nextValue))}
            style={styles.dashboardPressureSlider}
          />

          <EngineeringSignalBands tone={signalTone} />
        </View>

        <View style={styles.sliderRangeRow}>
          <Text style={styles.sliderRangeText}>0 bar</Text>
          <View
            style={[
              styles.signalStateBadge,
              {
                backgroundColor: signalPalette.surface,
                borderColor: signalPalette.border,
              },
            ]}>
            <Text
              style={[
                styles.signalStateText,
                { color: signalPalette.text },
              ]}>
              {getPressureSignalLabel(signalTone)}
            </Text>
          </View>
          <Text style={styles.sliderRangeText}>16 bar</Text>
        </View>
      </View>
    </View>
  );
}

// Dashboard flow discharge input uses the same number-stepper pattern as calibration flow.
function DashboardFlowRateField({
  value,
  onStep,
}: {
  value: string;
  onStep: FlowRateStepper;
}) {
  const flowRateValue = parseFlowRateValue(value);
  const isMinimumFlowRate = flowRateValue <= FLOW_RATE_MIN_M3H;

  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardControlCard}>
        <PanelStepperField
          label="Flow Discharge"
          value={String(flowRateValue)}
          unit="m3/h"
          chipText={`${flowRateValue} m3/h`}
          chipTone={flowRateValue > 0 ? 'stable' : 'default'}
          hint="Discharge volume shown in dashboard panel."
          onStep={(delta) => onStep(delta * FLOW_RATE_STEP_M3H)}
          isMinimumDisabled={isMinimumFlowRate}
        />
      </View>
    </View>
  );
}

// The dashboard input block owns live dashboard values independently from calibration.
function DashboardInputSection({
  dashboardForm,
  onChange,
  onFlowRateStep,
}: {
  dashboardForm: PumpRoomDashboardInputs;
  onChange: <Key extends keyof PumpRoomDashboardInputs>(
    key: Key,
    value: PumpRoomDashboardInputs[Key]
  ) => void;
  onFlowRateStep: FlowRateStepper;
}) {
  return (
    <View style={styles.summaryCard}>
      <DashboardAlarmField
        value={dashboardForm.temperatureAlarm}
        onChange={(nextValue) => onChange('temperatureAlarm', nextValue)}
      />
      <DashboardStatusField
        value={dashboardForm.currentStatus}
        onChange={(nextValue) => onChange('currentStatus', nextValue)}
      />
      <DashboardAmpereField
        value={dashboardForm.ampereStatus}
        onChange={(nextValue) => onChange('ampereStatus', nextValue)}
      />
      <DashboardPressureField
        label="Pressure Pump 1"
        value={dashboardForm.pressurePump1}
        onChange={(nextValue) => onChange('pressurePump1', nextValue)}
      />
      <DashboardPressureField
        label="Pressure Pump 2"
        value={dashboardForm.pressurePump2}
        onChange={(nextValue) => onChange('pressurePump2', nextValue)}
      />
      <DashboardFlowRateField
        value={dashboardForm.dischargeFlowRate}
        onStep={onFlowRateStep}
      />
    </View>
  );
}

// The screen component loads stored PLC inputs and composes all visual blocks.
export default function PumpRoom() {
  const [form, setForm] = useState(DEFAULT_PUMP_ROOM_PLC_INPUTS);
  const [dashboardForm, setDashboardForm] = useState(DEFAULT_DASHBOARD_INPUTS);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadValues() {
      const stored = await getStoredPumpRoomPlcInputs();

      if (isMounted) {
        setForm(stored);
        setDashboardForm(createDashboardInputsFromPlcInputs(stored));
        hasHydratedRef.current = true;
      }
    }

    loadValues();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    void setStoredPumpRoomPlcInputs(form);
  }, [form]);

  const updateField = (key: PumpRoomPlcInputKey, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateFlowRateByStep = (delta: number) => {
    setForm((current) => {
      const currentFlowRate = parseFlowRateValue(current[FLOW_RATE_FIELD_KEY]);

      return {
        ...current,
        [FLOW_RATE_FIELD_KEY]: formatFlowRateValue(currentFlowRate + delta),
      };
    });
  };

  const updateDashboardField = <Key extends keyof PumpRoomDashboardInputs>(
    key: Key,
    value: PumpRoomDashboardInputs[Key]
  ) => {
    setDashboardForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateDashboardFlowRateByStep = (delta: number) => {
    setDashboardForm((current) => {
      const currentFlowRate = parseFlowRateValue(current.dischargeFlowRate);

      return {
        ...current,
        dischargeFlowRate: String(clampFlowRateValue(currentFlowRate + delta)),
      };
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <PumpRoomHeader />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PumpRoomHero />
        <SensorCalibrationSection
          form={form}
          onChange={updateField}
          onFlowRateStep={updateFlowRateByStep}
        />
        <DashboardInputSection
          dashboardForm={dashboardForm}
          onChange={updateDashboardField}
          onFlowRateStep={updateDashboardFlowRateByStep}
        />
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
