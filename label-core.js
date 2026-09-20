"use strict";
// Physical sheet geometry is independent of the orientation of the label content.
const PAPER_PROFILES = Object.freeze({
  "a4-business-10": Object.freeze({
    id: "a4-business-10",
    name: "A4 名刺サイズラベル 10面（91×55mm）",
    note: "A-one F10A4-1対応／2列×5段",
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
  count: (p) => p.positions ? p.positions.length : p.columns * p.rows,
  geometry(p, cal, index) {
    const scale = cal.scale / 100;
    return {
      left: cal.x + (p.positions ? p.positions[0].left + (p.positions[index].left - p.positions[0].left) * scale : p.left) + (p.positions ? 0 : (index % p.columns) * (p.width + p.gapX) * scale),
      top:
        cal.y + (p.positions ? p.positions[0].top + (p.positions[index].top - p.positions[0].top) * scale : p.top + Math.floor(index / p.columns) * (p.height + p.gapY) * scale),
      width: p.width * scale,
      height: p.height * scale,
    };
  },
  inBounds(p, cal) {
    return Array.from({length:this.count(p)},(_,i)=>this.geometry(p,cal,i)).every(g=>
      g.left>=0 && g.top>=0 && g.left+g.width<=p.sheetWidth && g.top+g.height<=p.sheetHeight);
  },
  nextSlot(slots, blocked) {
    return slots.findIndex((id, i) => id === null && !blocked[i]);
  },
  printableIndices(s) {
    return s.slots.flatMap((id, i) =>
      id && !s.blocked[i] && !(s.logs||[]).find(log=>log.id===id)?.needsReview ? [i] : [],
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
    const photoHeight = Math.min(h - 6, (w - 10) * 0.48 * 4 / 3);
    const photoWidth = (photoHeight * 3) / 4;
    const textX = sideBySide ? 3 + photoWidth + 4 : 3;
    const textWidth = w - textX - 3;
    let textY = portrait && image ? 3 + (w - 6) / 1.5 + 3 : 3.5;

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


    }

    // Only occupied fields consume space. The photo geometry remains unchanged.
    if (record.date) {
      ctx.fillStyle = "#647266";
      ctx.font = "2.6px sans-serif";
      ctx.fillText(record.date.replaceAll("-", " / "), textX, textY);
      textY += 5.5;
    }
    ctx.fillStyle = "#26352e";
    ctx.font = "bold 3.6px sans-serif";
    const title = record.title.trim();
    const titleLines = title ? this.wrap(ctx, title, textWidth) : [];
    titleLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, textX, textY + i * 4.4));
    if (titleLines.length) textY += Math.min(titleLines.length, 2) * 4.4 + 2;

    ctx.font = "3px sans-serif";
    const memo = record.memo.trim();
    const lines = memo ? this.wrap(ctx, memo, textWidth) : [];
    const max = Math.max(0, Math.floor((h - 3 - textY) / 4.2));
    lines.slice(0, max).forEach((line, i) => ctx.fillText(line, textX, textY + i * 4.2));
    return textWidth > 0 && titleLines.length <= 2 && lines.length <= max;
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
