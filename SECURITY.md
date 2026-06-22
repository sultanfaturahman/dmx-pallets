# Security Hardening

Project ini masih frontend React/Vite. Proteksi terhadap serangan server,
website, dan database harus dipasang berlapis saat masuk production.

## Website

- Aktifkan HTTPS saja.
- Pakai security headers dari `public/_headers`.
- Pertahankan Content Security Policy ketat.
- Validasi input di frontend dan ulangi validasi yang sama di backend.
- Jalankan dependency audit sebelum deploy.

## Server

- Buka hanya port yang dibutuhkan, biasanya 80 dan 443.
- Pakai SSH key, matikan login password, dan aktifkan MFA untuk panel hosting.
- Pasang WAF, rate limit, dan proteksi brute force.
- Patch OS, runtime, reverse proxy, dan dependency secara rutin.
- Pisahkan environment production, staging, dan development.

## Database

- Jangan expose database ke internet publik.
- Pakai user database dengan hak minimum untuk aplikasi.
- Simpan secret di environment manager, bukan di source code.
- Aktifkan enkripsi at rest dan backup terenkripsi.
- Uji restore backup secara berkala.

## Monitoring

- Simpan audit log untuk login, perubahan data, dan perubahan konfigurasi.
- Pasang alert untuk trafik aneh, error rate tinggi, dan query database gagal.
- Siapkan incident response: isolasi server, rotasi secret, restore backup,
  dan laporan perubahan data.

## Minimum Sebelum Production

- Backend API dengan auth, role admin/user, dan session yang aman.
- Database private dengan backup otomatis.
- Security headers aktif di hosting.
- WAF atau reverse proxy dengan rate limit.
- Audit log dan alert operasional.
