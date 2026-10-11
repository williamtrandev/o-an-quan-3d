# Ô Ăn Quan 3D

Trò chơi dân gian Việt Nam trên bàn gỗ 3D giữa sân đình làng quê. Chơi ngay trên trình duyệt, máy tính lẫn điện thoại.

## Tính năng

- **Luật phổ biến:** 10 ô dân (mỗi ô 5 sỏi) và 2 ô quan (mỗi quan 10 điểm). Có rải tiếp, ăn quân, ăn dây, hết dân phải rải lại (vay của đối thủ khi thiếu), hết quan thì tàn dân, thu quân.
- **Đấu với máy:** AI negamax alpha-beta, 4 cấp (Dễ, Vừa, Khó, Cao thủ), chọn bên đi trước. AI chạy ngay trên trình duyệt, không cần server.
- **Hai người một máy:** camera tự xoay về phía người tới lượt.
- **Bàn gỗ khắc 3D:**
  - Ô được khoét thật vào bàn, vân gỗ sinh bằng code.
  - 50 viên sỏi và 2 viên quan.
  - Animation bốc, rải từng viên theo quỹ đạo cong; quân bị ăn bay vào rổ tre của người ăn.
- **Sân đình làng quê:** sân gạch, lũy tre, cây đa, đình làng mái cong, đống rơm, chum, dây đèn lồng.
  - Ba khung cảnh: ban ngày, chiều tà, đêm trăng (đèn lồng, đèn dầu, đom đóm).
- **Nhân vật chibi** ngồi hai bên bàn: nhìn theo tay rải, với tay khi đi quân, chống cằm khi nghĩ, ăn mừng hoặc buồn khi hết ván. Khi đấu với máy, đối thủ là robot.
- **Tiện ích khi chơi:**
  - Gợi ý nước đi.
  - Đi lại: khi đấu với máy, quay về lượt gần nhất của bạn.
  - Số sỏi hiện trên từng ô.
  - Tốc độ rải: thường hoặc nhanh.
  - Âm thanh tổng hợp bằng Web Audio, không cần file âm thanh.
- **Responsive:**
  - Màn ngang: nhìn từ phía người chơi.
  - Màn dọc (điện thoại): nhìn từ đầu bàn, để bàn chạy dọc màn hình và ô to, dễ chạm.

## Công nghệ

Next.js 16 · React 19 · React Three Fiber 9 · drei · three.js · postprocessing · zustand · Tailwind CSS 4 · motion · Vitest · TypeScript strict.

## Chạy

Yêu cầu Node 24 (`.nvmrc`) và pnpm 11.

```bash
pnpm install
pnpm dev          # http://localhost:3001
pnpm test         # luật chơi, AI, store
pnpm lint
pnpm typecheck
pnpm build
```

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `src/lib/game/rules.ts` | Luật chơi thuần TypeScript: trạng thái, nước đi hợp lệ, `applyMove` trả về chuỗi sự kiện để dựng animation |
| `src/lib/game/ai.ts` | AI negamax alpha-beta và các cấp độ |
| `src/lib/store.ts` | Store ván chơi: lượt, hàng đợi animation, lượt máy, đi lại, gợi ý |
| `src/lib/layout.ts` | Toạ độ bàn, ô, sỏi, rổ trong không gian 3D |
| `src/components/scene/` | Canvas, bàn khắc, sỏi và animation, sân đình, nhân vật |
| `src/components/ui/` | Menu, thanh điểm, luật chơi, kết quả, lớp nhãn trên bàn |
| `src/components/characters/` | Nhân vật chibi (dùng chung với chess3d) |

Khi chạy dev, store được gắn vào `window.__oanquan` và state của r3f vào `window.__oanquanThree()`, tiện cho việc debug và quay clip.
