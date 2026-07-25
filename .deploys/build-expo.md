# Build Expo — Local → Expo Cloud (EAS Build)

Panduan build APK/IPA dari mesin lokal ke server Expo (EAS Build). Build lokal
meng-upload **working directory** (bukan clone GitHub), jadi tak perlu commit dulu.

- Target project: **`@22archmage/epbox-mobile-rnex-imox`**
  (projectId `356b3d6b-db4e-42be-a574-8aec14630de6`, dari `extra.eas.projectId` di `app.json`).
- Dashboard build: <https://expo.dev/accounts/22archmage/projects/epbox-mobile-rnex-imox/builds>

---

## 1. Prasyarat (sekali saja)

```bash
# Login akun Expo (jalankan interaktif)
npx eas-cli@latest login
npx eas-cli@latest whoami     # verifikasi
```

`app.json` + `eas.json` sudah berisi projectId & profil build. Keystore Android
sudah dibuat pada build pertama → build berikutnya tidak minta kredensial lagi.

---

## 2. Build Android (APK test)

```bash
npx eas-cli@latest build --platform android --profile preview
```

Alur:
1. EAS kompres working dir lokal → upload ke cloud.
2. Build jalan di server; keystore diambil otomatis (remote credentials).
3. Selesai → link download `.apk` + halaman build di dashboard.

---

## 3. Opsi build

| Kebutuhan | Perintah |
|---|---|
| APK test | `--profile preview` |
| Tanpa prompt (script/CI) | tambah `--non-interactive` |
| Dev client | `--profile development` |
| Rilis produksi | `--profile production` |
| iOS (butuh kredensial Apple) | `--platform ios` |
| Lihat semua build | `npx eas-cli@latest build:list` |

---

## 4. Catatan penting

- **Cleartext MQTT/WS**: `app.json` memakai plugin `expo-build-properties` dengan
  `android.usesCleartextTraffic: true`. Ini yang membuat APK bisa konek `mqtt://`
  / `ws://` non-TLS. Perubahan native → **wajib rebuild APK** (bukan OTA update).
- Transport runtime: dev/Expo Go = `ws`, APK standalone = `tcp` (`mqtt://`),
  lihat `src/lib/mqtt-settings.ts` (`getMqttRuntimeTransport`).
- Build lokal membawa **perubahan yang belum di-commit** — pastikan working dir
  bersih dari file sampah sebelum build.
- Jika suatu saat pindah ke build via GitHub webhook, integrasi GitHub harus
  di-arahkan ke project `epbox-mobile-rnex-imox` (bukan `imox`) agar tidak kena
  error slug/projectId mismatch.

---

## 5. Kredensial broker MQTT

Kredensial broker (URL/host/port, username, password, client id) **tidak**
di-commit — dimasukkan user lewat layar Settings aplikasi (disimpan di device
storage). Untuk uji koneksi dari CLI pakai `scripts/mqtt-probe.mjs` dengan env var.
