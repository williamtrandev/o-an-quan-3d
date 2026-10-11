# oanquan: Ô Ăn Quan 3D

Game dân gian Ô ăn quan chạy trên trình duyệt (Next.js + React Three Fiber). Đây là project anh em của `../chess3d`, dùng cùng bộ công nghệ và quy ước.

## Tài liệu

| File | Nội dung | Khi nào cập nhật |
|---|---|---|
| `README.md` | Tính năng, cách chạy, cấu trúc | Khi thêm tính năng hoặc đổi cấu trúc |
| `PROGRESS.md` | Tiến độ, đang làm gì, vướng gì | **Sau mỗi phiên làm việc / mỗi task hoàn thành** |

## Quy tắc

1. Luật chơi chỉ nằm trong `src/lib/game/rules.ts` (thuần TypeScript, không phụ thuộc React hay three). UI và scene không tự tính luật.
2. `applyMove` trả về state mới kèm danh sách sự kiện (`pickup`, `drop`, `capture`, `refill`, `sweep`, `end`). Scene chỉ dựng animation theo đúng các sự kiện đó.
3. Mọi thay đổi logic đều có test. `rules.ts` phải giữ coverage cao, kể cả bất biến tổng điểm luôn bằng 70.
4. Hình học tự dựng phải có pháp tuyến hợp lệ. Pháp tuyến bằng 0 sinh ra NaN, và bloom sẽ làm đen cả màn hình (`NormalGuard` trong `GameCanvas` là lưới an toàn).

## Quy ước

- TypeScript strict, không dùng non-null assertion (`!`). Dùng `pick()` trong `src/lib/util.ts`.
- Commit theo Conventional Commits, viết bằng tiếng Anh.
- Tài liệu bằng tiếng Việt. Code, tên biến, comment bằng tiếng Anh.

## Lệnh

```bash
pnpm dev | test | lint | typecheck | build
```

Dev server chạy ở cổng 3001 (chess3d dùng cổng 3000).
