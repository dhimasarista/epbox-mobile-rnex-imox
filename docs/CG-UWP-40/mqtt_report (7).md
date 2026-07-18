

<!-- Start of picture text -->
CARLO GAVAZZI<br><!-- End of picture text -->



**Functions list and their commands:** 

|**Counter**|**id**|
|---|---|
|Smoke Status|3549|
|Temperature|3585|
|PLC - SIEMENS|6563|
|Pressure Transmitter - Pump 1|6983|
|Pressure Transmitter - Pump 2|7019|



|**Command**|**Payload**|
|---|---|
|Increase|{"id": <id>, "cmd": "Increase", "value":<value>}|
|Decrease|{"id": <id>, "cmd": "Decrease", "value":<value>}|
|SetValue|{"id": <id>, "cmd": "SetValue", "value":<value>}|
|ResetValue|{"id": <id>, "cmd": "ResetValue"}|
|Freeze|{"id": <id>, "cmd": "Freeze"}|
|Unfreeze|{"id": <id>, "cmd": "Unfreeze"}|
|FreezeUnfreezeToggle|{"id": <id>, "cmd": "FreezeUnfreezeToggle"}|
|ResetRollover|{"id": <id>, "cmd": "ResetRollover"}|



|**Alarm**|**id**|
|---|---|
|Alarm|3667|



|**Command**|**Payload**|
|---|---|
|Acknowledgement|{"id": <id>, "cmd": "Acknowledgement"}|
|Reset|{"id": <id>, "cmd": "Reset"}|
|ResetOn|{"id": <id>, "cmd": "ResetOn"}|
|ResetOnTimeout|{"id": <id>, "cmd": "ResetOnTimeout"}|
|ResetOff|{"id": <id>, "cmd": "ResetOff"}|
|ResetToggle|{"id": <id>, "cmd": "ResetToggle"}|
|ResetToggleTimeout|{"id": <id>, "cmd": "ResetToggleTimeout"}|
|TestAlarmOn|{"id": <id>, "cmd": "TestAlarmOn"}|
|RemoveTestAlarmOn|{"id": <id>, "cmd": "RemoveTestAlarmOn"}|
|TestAlarmOnToggle|{"id": <id>, "cmd": "TestAlarmOnToggle"}|
|TestAlarmOff|{"id": <id>, "cmd": "TestAlarmOff"}|
|RemoveTestAlarmOff|{"id": <id>, "cmd": "RemoveTestAlarmOff"}|
|ResetToggleTimeout|{"id": <id>, "cmd": "ResetToggleTimeout"}|



|**Zone temperature**|**id**|
|---|---|
|Zone temperature|4147|



|**Command**|**Payload**|
|---|---|
|HeatingActivation|{"id": <id>, "cmd": "HeatingActivation"}|
|HeatingDeactivation|{"id": <id>, "cmd": "HeatingDeactivation"}|
|HeatingToggleActivation|{"id": <id>, "cmd": "HeatingToggleActivation"}|
|HeatingSetPointSelection|{"id": <id>, "cmd": "HeatingSetPointSelection", "value":<value>}|
|HeatingSetS1|{"id": <id>, "cmd": "HeatingSetS1", "value":<value>}|
|HeatingSetS2|{"id": <id>, "cmd": "HeatingSetS2", "value":<value>}|
|HeatingSetS3|{"id": <id>, "cmd": "HeatingSetS3", "value":<value>}|
|HeatingOffset|{"id": <id>, "cmd": "HeatingOffset", "value":<value>}|
|HeatingFanSpeedMode|{"id": <id>, "cmd": "HeatingFanSpeedMode", "value":<value>}|
|HeatingActivateForceOn|{"id": <id>, "cmd": "HeatingActivateForceOn"}|
|HeatingDeactivateForceOn|{"id": <id>, "cmd": "HeatingDeactivateForceOn"}|
|HeatingToggleForceOn|{"id": <id>, "cmd": "HeatingToggleForceOn"}|
|HeatingActivateForceOff|{"id": <id>, "cmd": "HeatingActivateForceOff"}|
|HeatingDeactivateForceOff|{"id": <id>, "cmd": "HeatingDeactivateForceOff"}|
|HeatingToggleForceOff|{"id": <id>, "cmd": "HeatingToggleForceOff"}|
|CoolingActivation|{"id": <id>, "cmd": "CoolingActivation"}|
|CoolingDeactivation|{"id": <id>, "cmd": "CoolingDeactivation"}|
|CoolingToggleActivation|{"id": <id>, "cmd": "CoolingToggleActivation"}|
|CoolingSetPointSelection|{"id": <id>, "cmd": "CoolingSetPointSelection", "value":<value>}|
|CoolingSetS1|{"id": <id>, "cmd": "CoolingSetS1", "value":<value>}|
|CoolingSetS2|{"id": <id>, "cmd": "CoolingSetS2", "value":<value>}|
|CoolingSetS3|{"id": <id>, "cmd": "CoolingSetS3", "value":<value>}|
|CoolingOffset|{"id": <id>, "cmd": "CoolingOffset", "value":<value>}|
|CoolingFanSpeedMode|{"id": <id>, "cmd": "CoolingFanSpeedMode", "value":<value>}|
|CoolingActivateForceOn|{"id": <id>, "cmd": "CoolingActivateForceOn"}|
|CoolingDeactivateForceOn|{"id": <id>, "cmd": "CoolingDeactivateForceOn"}|
|CoolingToggleForceOn|{"id": <id>, "cmd": "CoolingToggleForceOn"}|
|CoolingActivateForceOff|{"id": <id>, "cmd": "CoolingActivateForceOff"}|
|CoolingDeactivateForceOff|{"id": <id>, "cmd": "CoolingDeactivateForceOff"}|
|CoolingToggleForceOff|{"id": <id>, "cmd": "CoolingToggleForceOff"}|
|DisableOn|{"id": <id>, "cmd": "DisableOn"}|



|DisableOnTimeout|{"id": <id>, "cmd": "DisableOnTimeout"}|
|---|---|
|DisableOff|{"id": <id>, "cmd": "DisableOff"}|
|DisableToggle|{"id": <id>, "cmd": "DisableToggle"}|
|DisableToggleTimeout|{"id": <id>, "cmd": "DisableToggleTimeout"}|



