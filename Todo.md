Tujuan Pembuatan Fitur: Saya ingin menambahkan fitur alarm yang dapat:
Membaca dan menampilkan status "Alarm" dan "Siren" secara real-time dari payload MQTT (Subscribe).
Menyediakan tombol aksi (Form Input/Button) untuk mengirimkan perintah kontrol (Publish) ke controller UWP. Tujuan utamanya adalah agar user bisa me-reset alarm dari dashboard setelah terjadi kondisi bahaya (misal: suhu naik atau asap). Dengan melakukan Reset atau Acknowledge, alarm akan bersih dan sistem bisa aktif kembali jika bahaya terjadi lagi di masa depan.
Data Telemetri Masuk (MQTT Subscribe): Berikut adalah contoh struktur data JSON yang dikirimkan oleh UWP ke dashboard via MQTT (Topik: epbox/imox/demo/site/batam/edge/cg-uwp40-01/metrics):
{
  "ip": "192.168.16.20",
  "sn": "BZ2730006001L",
  "mac": "00:19:EE:12:AD:C6",
  "time": "Asia/Jakarta",
  "devices": [
    {
      "id": 3667,
      "name": "Alarm",
      "pn": "FxAlarm",
      "signals": [
        {
          "id": 3669,
          "name": "Alarm status",
          "time": 1782128615496,
          "value": 2.0,
          "unit": "",
          "type": 0
        },
        {
          "id": 3672,
          "name": "Siren status",
          "time": 1782128615496,
          "value": 1.0,
          "unit": "",
          "type": 2
        }
      ]
    }
  ]
}
Catatan Data:
Jika "Siren status" = 1.0, artinya Sirine sedang ON.
Jika "Alarm status" = 1.0 atau 2.0, artinya alarm sedang aktif atau menunggu konfirmasi.
Format Perintah Keluar (MQTT Publish): Untuk memanipulasi device Alarm (ID: 3667), dashboard harus melakukan publish JSON dengan format berikut: {"id": <device_id>, "cmd": "<command_name>"}. Daftar perintah yang valid untuk ID 3667 antara lain:
{"id": 3667, "cmd": "Acknowledgement"} -> Untuk mengonfirmasi alarm.
{"id": 3667, "cmd": "Reset"} -> Untuk memulihkan/mereset alarm secara penuh.
{"id": 3667, "cmd": "ResetOn"}
{"id": 3667, "cmd": "ResetOff"}
{"id": 3667, "cmd": "TestAlarmOn"} -> Untuk mengetes menyalakan alarm buatan.
{"id": 3667, "cmd": "TestAlarmOff"} -> Untuk menghentikan tes alarm.
Tugas yang Harus Kamu Kerjakan:
Buatkan struktur kode UI (bisa menggunakan HTML/Tailwind/JS murni, atau React/Vue) untuk komponen "Accommodation Room Alarm".
UI tersebut harus memiliki indikator status visual (misalnya warna merah jika Alarm Status > 0 atau Siren Status == 1.0). Tuliskan fungsi ekstraksi JSON tersebut di JS.
Buatkan form/tombol kontrol utama, khususnya tombol "Acknowledge Alarm" dan "Reset Alarm".
Buatkan juga tombol untuk mode simulasi, yaitu "Test Alarm ON" dan "Test Alarm OFF".
