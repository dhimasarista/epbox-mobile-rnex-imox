pump a running
pump b running
sv1_opened
sv1_closed
sv2_opened
sv2_closed
Local_zone_activation
remote_zone_activation
fgs_conf_fire
level_tank_high
level_tank_low
pump c running
local mode
remote mode
14 spare
15 spare


Note
jadi ada dua modbus register :
- From_PLC : 1 word (uint16)
di mqtt : device id nya 6563
    - W[0] : Nerima DO Output (Bit Unpacking)
- To_PLC : 4 word (uint64)
di mqtt : device id nya 7193
    - W[0] : Ngirim DO Output (Bit Packing)
    - W[1] : Pressure Transmitter 1
    - W[2] : Pressure Transmitter 2
    - W[3] : spare


referensi :
- docs\mqtt_report (12).pdf
- docs\Modbus.pdf