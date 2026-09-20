"use strict";
// Physical sheet geometry is independent of the orientation of the label content.
const PAPER_PROFILES = Object.freeze({
  "a4-business-10": Object.freeze({
    id: "a4-business-10",
    name: "A4 名刺サイズラベル 10面（91×55mm）",
    sheetWidth: 210,
    sheetHeight: 297,
    width: 91,
    height: 55,
    columns: 2,
    rows: 5,
    left: 14,
    top: 11,
    gapX: 0,
    gapY: 0,
  }),
});
const DEFAULT_PAPER = "a4-business-10";
const LabelCore = {
  profile: (id) => PAPER_PROFILES[id],
  count: (p) => p.columns * p.rows,
  geometry(p, cal, index) {
    const scale = cal.scale / 100;
    return {
      left: p.left + cal.x + (index % p.columns) * (p.width + p.gapX) * scale,
      top:
        p.top +
        cal.y +
        Math.floor(index / p.columns) * (p.height + p.gapY) * scale,
      width: p.width * scale,
      height: p.height * scale,
    };
  },
  inBounds(p, cal) {
    const first = this.geometry(p, cal, 0),
      last = this.geometry(p, cal, this.count(p) - 1);
    return (
      first.left >= 0 &&
      first.top >= 0 &&
      last.left + last.width <= p.sheetWidth &&
      last.top + last.height <= p.sheetHeight
    );
  },
  nextSlot(slots, blocked) {
    return slots.findIndex((id, i) => id === null && !blocked[i]);
  },
  selectedIndices(s) {
    return s.slots.flatMap((id, i) =>
      id && !s.blocked[i] && s.selected[i] ? [i] : [],
    );
  },
  wrap(ctx, text, width) {
    const lines = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const character of Array.from(paragraph)) {
        if (line && ctx.measureText(line + character).width > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
      lines.push(line);
    }
    return lines;
  },
  render(canvas, record, image, p = PAPER_PROFILES[DEFAULT_PAPER]) {
    const portrait = record.orientation === "portrait";
    const w = portrait ? p.height : p.width;
    const h = portrait ? p.width : p.height;

    const px = 12;
    canvas.width = Math.round(w * px);
    canvas.height = Math.round(h * px);

    const ctx = canvas.getContext("2d");
    ctx.scale(px, px);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.textBaseline = "top";

    // 横向きシール：左に3:4の写真、右に文字
    const sideBySide = !portrait && Boolean(image);
    const photoHeight = h - 6;
    const photoWidth = (photoHeight * 3) / 4;
    const textX = sideBySide ? 3 + photoWidth + 4 : 3;
    const textWidth = w - textX - 3;
    // 縦向きでは、写真の下から文字を配置
    const dateY = portrait && image ? 3 + (w - 6) / 1.5 + 3 : 3.5;
    const titleY = dateY + 5.5;

    // 日付
    ctx.fillStyle = "#647266";
    ctx.font = "2.6px sans-serif";
    ctx.fillText(record.date.replaceAll("-", " / "), textX, dateY);
    // タイトル
    ctx.fillStyle = "#26352e";
    ctx.font = "bold 3.6px sans-serif";
    const titleLines = this.wrap(ctx, record.title, textWidth);
    titleLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, textX, titleY + i * 4.4);
    });

    let memoY = 22;

    // 写真
    if (image) {
      const box = portrait
        ? { x: 3, y: 3, w: w - 6, h: (w - 6) / 1.5 }
        : { x: 3, y: 3, w: photoWidth, h: photoHeight };

      let sw = image.width;
      let sh = image.height;
      if (sw / sh > box.w / box.h) {
        sw = (sh * box.w) / box.h;
      } else {
        sh = (sw * box.h) / box.w;
      }

      ctx.drawImage(
        image,
        ((image.width - sw) * record.x) / 100,
        ((image.height - sh) * record.y) / 100,
        sw,
        sh,
        box.x,
        box.y,
        box.w,
        box.h,
      );

      if (portrait) memoY = titleY + 13;
    }

    // メモ
    ctx.font = "3px sans-serif";
    const lines = this.wrap(ctx, record.memo, textWidth);
    const max = Math.floor((h - 3 - memoY) / 4.2);
    lines.slice(0, max).forEach((line, i) => {
      ctx.fillText(line, textX, memoY + i * 4.2);
    });

    return titleLines.length <= 2 && lines.length <= max;
  },
  physicalCanvas(source, orientation, createCanvas) {
    if (orientation !== "portrait") return source;
    const out = createCanvas();
    out.width = source.height;
    out.height = source.width;
    const ctx = out.getContext("2d");
    ctx.translate(out.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(source, 0, 0);
    return out;
  },
};
if (typeof module !== "undefined")
  module.exports = { LabelCore, PAPER_PROFILES, DEFAULT_PAPER };
