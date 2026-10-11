# Tiến độ

## Trạng thái hiện tại

Bản chơi được đầu tiên đã xong: đấu với máy 4 cấp và hai người một máy, bàn 3D giữa sân đình, có 3 khung cảnh, chạy được trên máy tính và điện thoại.

## Nhật ký

### 2026-10-11

- **Khởi tạo project** `oanquan`, nằm cùng cấp với `chess3d`. Dùng cùng bộ công nghệ: Next.js 16, React 19, React Three Fiber, Tailwind 4, Vitest; TypeScript strict và ESLint strict.
- **Lõi luật** (`src/lib/game/rules.ts`):
  - Rải, rải tiếp, ăn quân, ăn dây, ô quan đã trống được coi như ô trống.
  - Hết dân phải rải lại, vay của đối thủ khi thiếu.
  - Hết quan thì tàn dân, thu quân.
  - Có test, kể cả 200 ván ngẫu nhiên kiểm tra tổng điểm luôn bằng 70.
- **AI negamax alpha-beta**, 4 cấp. Cấp Cao thủ tìm sâu 7 nước mà vẫn chạy trên luồng chính trong vài chục ms. Đánh thắng người chơi ngẫu nhiên ở hơn 10/12 ván.
- **Scene 3D:**
  - Bàn gỗ khắc ô thật, vân gỗ sinh bằng code.
  - 50 sỏi và 2 quan, animation bốc và rải từng viên theo sự kiện của luật; quân bị ăn bay vào rổ tre.
  - Sân đình: lũy tre, cây đa, đình mái cong, rơm, chum, đèn lồng.
  - 3 khung cảnh; đêm có đèn dầu và đom đóm.
  - Nhân vật chibi lấy từ chess3d.
- **Giao diện:** menu, thanh điểm, gợi ý, đi lại, tốc độ, bật tắt số sỏi, bảng luật chơi, hộp kết quả. Nhãn số và mũi tên chọn hướng là lớp DOM, được chiếu vị trí theo từng khung hình.
- **Màn dọc:** camera nhìn từ đầu bàn để bàn chạy dọc màn hình.
- **Sửa lỗi:**
  - Màn hình đen ở một số góc nhìn: do pháp tuyến bằng 0 (vòng sáng ô quan, `RoundedBox` của robot) cộng với bloom. Đã sửa đường viền và thêm `NormalGuard`.
  - Lỗi console của drei `Html`: đã thay bằng lớp nhãn tự chiếu vị trí.

## Ý tưởng tiếp theo

- Chơi online hai người (Socket.IO) và bảng xếp hạng.
- Tuỳ chọn luật: quan non, số sỏi mỗi ô, quan tính 5 hay 10 điểm.
- Mức đồ hoạ thấp cho máy yếu (tắt bóng, tắt hậu kỳ).
- Clip giới thiệu bằng skill `william-create-clip` (đã có handle `window.__oanquan` và `window.__oanquanThree`).
