import { Slider } from '@expo/ui/community/slider';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEFAULT_PUMP_ROOM_PLC_INPUTS,
  getStoredPumpRoomPlcInputs,
  PUMP_ROOM_PLC_FIELDS,
  type PumpRoomPlcInputKey,
  type PumpRoomPlcInputs,
} from '@/lib/pump-room-demo';
import { AppColors } from '@/styles';
import { styles } from '@/styles/screens/station.styles';

// Sensor field constants keep all UI limits and steps in one place.
const PRESSURE_MIN_BAR = 0;
const PRESSURE_DANGER_BAR = 10.2;
const PRESSURE_SLIDER_MAX_BAR = 16;
const PRESSURE_FIELD_KEYS: PumpRoomPlcInputKey[] = ['pressurePump1', 'pressurePump2'];
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
          <Text style={styles.heroBadgeText}>Pump Room Active</Text>
        </View>
        <View style={styles.liveChip}>
          <View style={[styles.liveDot, styles.plcDot]} />
          <Text style={styles.liveChipText}>Calibration Source</Text>
        </View>
      </View>

      <Text style={styles.heroTitle}>Operational Parameters</Text>
      <Text style={styles.heroSubtitle}>
        Calibrate pump pressure and discharge flow for live monitoring.
      </Text>
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
  const isDangerPressure = pressureValue >= PRESSURE_DANGER_BAR;

  return (
    <View style={styles.fieldBlock}>
      <View style={styles.fieldHeaderRow}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        <Text
          style={[
            styles.pressureValue,
            isDangerPressure && styles.pressureValueDanger,
          ]}>
          {formatPressureValue(pressureValue)}
        </Text>
      </View>

      <Slider
        value={pressureValue}
        minimumValue={PRESSURE_MIN_BAR}
        maximumValue={PRESSURE_SLIDER_MAX_BAR}
        step={0.1}
        minimumTrackTintColor={isDangerPressure ? AppColors.error : AppColors.primary}
        maximumTrackTintColor={AppColors.border}
        thumbTintColor={isDangerPressure ? AppColors.error : AppColors.primary}
        onValueChange={(nextValue) => onChange(field.key, formatPressureValue(nextValue))}
        style={styles.pressureSlider}
      />

      <View style={styles.sliderRangeRow}>
        <Text style={styles.sliderRangeText}>0 bar</Text>
        <View
          style={[
            styles.pressureLimitBadge,
            isDangerPressure && styles.pressureLimitBadgeDanger,
          ]}>
          <Text
            style={[
              styles.pressureLimitText,
              isDangerPressure && styles.pressureLimitTextDanger,
            ]}>
            {'Danger >= 10.2 bar'}
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
  onChange,
  onStep,
}: {
  field: PumpRoomField;
  value: string;
  onChange: FieldUpdater;
  onStep: FlowRateStepper;
}) {
  const flowRateValue = parseFlowRateValue(value);
  const isMinimumFlowRate = flowRateValue <= FLOW_RATE_MIN_M3H;

  const updateFlowRate = (nextValue: number) => {
    onChange(field.key, formatFlowRateValue(nextValue));
  };

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
          onChangeText={(nextValue) => updateFlowRate(parseFlowRateValue(nextValue))}
          onStep={(delta) => onStep(delta * FLOW_RATE_STEP_M3H)}
          isMinimumDisabled={isMinimumFlowRate}
        />
      </View>
    </View>
  );
}

// Standard input fields are kept for any future calibration values.
function TextCalibrationField({
  field,
  value,
  onChange,
}: {
  field: PumpRoomField;
  value: string;
  onChange: FieldUpdater;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      <TextInput
        value={value}
        onChangeText={(nextValue) => onChange(field.key, nextValue)}
        placeholder={field.placeholder}
        placeholderTextColor="#9AA09A"
        style={styles.input}
        keyboardType="numeric"
      />
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
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Sensor Calibration</Text>
        <View style={styles.sectionBadge}>
          <View style={[styles.inlineDot, styles.plcDot]} />
        </View>
      </View>

      <Text style={styles.sectionDescription}>
        Adjust pressure transmitter and discharge flow references.
      </Text>

      {PUMP_ROOM_PLC_FIELDS.map((field) => {
        if (PRESSURE_FIELD_KEYS.includes(field.key)) {
          return (
            <PressureTransmitterField
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={onChange}
            />
          );
        }

        if (field.key === FLOW_RATE_FIELD_KEY) {
          return (
            <FlowRateField
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={onChange}
              onStep={onFlowRateStep}
            />
          );
        }

        return (
          <TextCalibrationField
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
          <View style={styles.alarmToggleTrack}>
            <Text
              style={[
                styles.alarmToggleLabel,
                !value && styles.alarmToggleLabelActive,
              ]}>
              
            </Text>
            <Text
              style={[
                styles.alarmToggleLabel,
                value && styles.alarmToggleLabelActive,
              ]}>
              {/* ALARM */}
            </Text>
          </View>

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
  onChangeText,
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
  onChangeText: (value: string) => void;
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
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="0"
            placeholderTextColor="#9AA09A"
            style={styles.dashboardReadoutInput}
            keyboardType="number-pad"
          />
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
          chipTone={isHighAmpere ? 'warning' : 'default'}
          hint="Current draw reference for dashboard panel."
          onChangeText={(nextValue) => onChange(formatAmpereValue(parseAmpereValue(nextValue)))}
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
  const isDangerPressure = pressureValue >= PRESSURE_DANGER_BAR;

  return (
    <View style={styles.dashboardFieldBlock}>
      <View style={styles.dashboardControlCard}>
        <View style={styles.dashboardControlHeader}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View
            style={[
              styles.dashboardValueChip,
              isDangerPressure && styles.dashboardValueChipDanger,
            ]}>
            <Text
              style={[
                styles.dashboardValueChipText,
                isDangerPressure && styles.dashboardValueChipTextDanger,
              ]}>
              {pressureValue.toFixed(1)} bar
            </Text>
          </View>
        </View>

        <Slider
          value={pressureValue}
          minimumValue={PRESSURE_MIN_BAR}
          maximumValue={PRESSURE_SLIDER_MAX_BAR}
          step={0.1}
          minimumTrackTintColor={isDangerPressure ? AppColors.error : AppColors.primary}
          maximumTrackTintColor={AppColors.border}
          thumbTintColor={isDangerPressure ? AppColors.error : AppColors.primary}
          onValueChange={(nextValue) => onChange(formatDashboardPressureValue(nextValue))}
          style={styles.dashboardPressureSlider}
        />

        <View style={styles.sliderRangeRow}>
          <Text style={styles.sliderRangeText}>0 bar</Text>
          <View
            style={[
              styles.dashboardValueChip,
              isDangerPressure ? styles.dashboardValueChipDanger : styles.dashboardValueChipStable,
            ]}>
            <Text
              style={[
                styles.dashboardValueChipText,
                isDangerPressure
                  ? styles.dashboardValueChipTextDanger
                  : styles.dashboardValueChipTextStable,
              ]}>
              {isDangerPressure ? 'High Load' : 'Stable'}
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
  onChange,
  onStep,
}: {
  value: string;
  onChange: (value: string) => void;
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
          onChangeText={(nextValue) => onChange(String(parseFlowRateValue(nextValue)))}
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
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.summaryTitle}>Live Dashboard View</Text>
        {/* <View style={styles.sectionBadge}>
          <View style={[styles.inlineDot, styles.dashboardDot]} />
        </View> */}
      </View>

      <Text style={styles.sectionDescription}>
        Operational status values shown on the dashboard display.
      </Text>

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
        onChange={(nextValue) => onChange('dischargeFlowRate', nextValue)}
        onStep={onFlowRateStep}
      />
    </View>
  );
}

// The screen component loads stored PLC inputs and composes all visual blocks.
export default function PumpRoom() {
  const [form, setForm] = useState(DEFAULT_PUMP_ROOM_PLC_INPUTS);
  const [dashboardForm, setDashboardForm] = useState(DEFAULT_DASHBOARD_INPUTS);

  useEffect(() => {
    let isMounted = true;

    async function loadValues() {
      const stored = await getStoredPumpRoomPlcInputs();

      if (isMounted) {
        setForm(stored);
        setDashboardForm(createDashboardInputsFromPlcInputs(stored));
      }
    }

    loadValues();

    return () => {
      isMounted = false;
    };
  }, []);

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
