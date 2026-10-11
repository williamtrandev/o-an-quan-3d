'use client';

import { Dialog } from './Dialog';

/** How to play, in short. */
export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Luật chơi Ô ăn quan">
      <ol className="space-y-3 text-sm leading-relaxed text-[#f6ead2]/85">
        <li>
          <b className="text-[#e9b949]">Bàn cờ:</b> 10 ô dân, mỗi ô 5 viên sỏi, chia đều mỗi bên 5
          ô. Hai đầu là hai ô quan, mỗi ô có một viên quan lớn tính <b>10 điểm</b>.
        </li>
        <li>
          <b className="text-[#e9b949]">Đi quân:</b> chọn một ô dân bên mình còn sỏi, bốc hết rồi
          rải mỗi ô một viên theo chiều bạn chọn, kể cả ô quan.
        </li>
        <li>
          <b className="text-[#e9b949]">Rải tiếp:</b> rải hết, nếu ô kế tiếp còn sỏi thì bốc ô đó
          rải tiếp. Gặp ô quan còn quân thì dừng lượt.
        </li>
        <li>
          <b className="text-[#e9b949]">Ăn quân:</b> nếu ô kế tiếp trống mà ô sau đó có quân thì ăn
          hết ô đó. Sau ô vừa ăn lại là một ô trống rồi một ô có quân thì ăn tiếp: <i>ăn dây</i>.
          Hai ô trống liền nhau thì mất lượt.
        </li>
        <li>
          <b className="text-[#e9b949]">Hết dân:</b> đến lượt mà 5 ô của mình trống thì phải lấy 5
          viên đã ăn rải lại, mỗi ô một viên. Không đủ thì vay của đối thủ, cuối ván trả lại.
        </li>
        <li>
          <b className="text-[#e9b949]">Kết thúc:</b> khi cả hai ô quan đã bị ăn hết (
          <i>hết quan, tàn dân</i>), sỏi còn trên ô dân bên nào thuộc về bên đó. Ai nhiều điểm hơn
          thắng.
        </li>
      </ol>
      <p className="mt-4 rounded-2xl bg-white/5 p-3 text-xs text-[#f6ead2]/60">
        Mẹo: chạm vào một ô dân sáng viền, rồi chọn mũi tên để rải theo chiều đó. Nút <b>Gợi ý</b>{' '}
        chỉ nước đi tốt.
      </p>
    </Dialog>
  );
}
