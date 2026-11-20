// Design space is 100 units from paws to ear tips. The caller owns the camera.
const HEAD_HEIGHT = 58;
const MOUTH_LINE = .808;

function ratio(image) {
  return (image.naturalWidth || image.width) / (image.naturalHeight || image.height);
}

function blinkAt(t, center, duration) {
  const distance = Math.abs(t - center) / duration;
  return distance < 1 ? (1 + Math.cos(distance * Math.PI)) * .5 : 0;
}

function paintEye(ctx, eye, x, y, width, openness) {
  const height = width / ratio(eye);
  const open = Math.max(.01, openness);
  const lowerLid = y + height * .16 * (1 - open);
  ctx.drawImage(eye, x - width / 2, lowerLid - height * open / 2, width, height * open);
  if (open < .25) {
    ctx.save();
    ctx.globalAlpha *= 1 - open / .25;
    ctx.strokeStyle = '#57321f';
    ctx.lineWidth = .61;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - width * .48, lowerLid + .15);
    ctx.quadraticCurveTo(x, lowerLid - 1.7, x + width * .48, lowerLid + .15);
    ctx.stroke();
    ctx.restore();
  }
}

function paintHead(ctx, image, width, happy) {
  // Keep the upper lip in place as the lower jaw opens to release the stems.
  const sw = image.naturalWidth || image.width, sh = image.naturalHeight || image.height;
  const lip = sh * MOUTH_LINE, chin = sh * .918;
  const top = -HEAD_HEIGHT, lipY = top + HEAD_HEIGHT * MOUTH_LINE;
  const jaw = HEAD_HEIGHT * (chin - lip) / sh * (.48 + .52 * happy);
  const overlap = .55;
  ctx.drawImage(image, 0, 0, sw, lip + overlap * sh / HEAD_HEIGHT, -width / 2, top, width, lipY - top + overlap);
  ctx.drawImage(image, 0, lip, sw, (chin - lip) * (1 + overlap / jaw), -width / 2, lipY, width, jaw + overlap);
  ctx.drawImage(image, 0, chin, sw, sh - chin, -width / 2, lipY + jaw, width, -lipY - jaw);
}

function paintPaw(ctx, paw, side, phase, energy, offer, sway, bounce) {
  const swing = phase * energy;
  const lift = Math.max(0, swing);
  const width = 13 * (1 + swing * .17);
  const height = 26.5 - 6.4 * lift + 2.3 * Math.max(0, -swing);
  ctx.save();
  ctx.translate(side * (11.3 + 1.3 * swing) + sway * .68, -26.5 + bounce * .52 - lift * 1.5 - offer * .5);
  ctx.rotate(side * (.045 + .12 * swing) + sway * .012);
  ctx.scale(side < 0 ? 1 : -1, 1);
  ctx.drawImage(paw, -width / 2, -.5, width, height);
  ctx.restore();
}

export function drawClover(ctx, art, {time = 0, gait = 0, energy = 0, offer = 0, happy = 0, tilt = 0} = {}) {
  const stride = Math.sin(gait);
  const sway = stride * 1.32 * energy + Math.sin(time * 1.55) * .20;
  const bounce = -2.65 * energy * stride * stride;
  const breath = Math.sin(time * 2.75) * .48;
  const chest = art['pov-clover-chest'], paw = art['pov-clover-paw'];
  const tail = art['pov-clover-tail'], head = art['pov-clover-head'];

  // The tail arcs out from behind her rump. Each forepaw has its own lift/plant cycle.
  ctx.save();
  ctx.translate(18 + sway * .5, -17 + bounce + breath * .3);
  const wag = Math.sin(time * 12 + .25 * Math.sin(time * 2.7));
  ctx.rotate(-.06 + wag * (.35 + .13 * energy + .18 * happy));
  ctx.scale(1 + .09 * wag, 1);
  const tailHeight = 29;
  const tailWidth = tailHeight * ratio(tail);
  ctx.drawImage(tail, -tailWidth * .1, -tailHeight * .9, tailWidth, tailHeight);
  ctx.restore();

  const chestHeight = 49 + breath * .55;
  const chestWidth = 48;
  const chestTop = -3 - chestHeight + bounce;
  const chestLeft = sway * .54 - chestWidth / 2;
  ctx.drawImage(chest, chestLeft, chestTop, chestWidth, chestHeight);
  paintPaw(ctx, paw, -1, stride, energy, offer, sway, bounce);
  paintPaw(ctx, paw, 1, -stride, energy, offer, sway, bounce);
  // The ruff overlaps the roots of both limbs where the shoulders articulate.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(chestLeft, chestTop);
  ctx.lineTo(chestLeft + chestWidth, chestTop);
  ctx.lineTo(chestLeft + chestWidth, chestTop + chestHeight * .44);
  ctx.quadraticCurveTo(sway * .54, chestTop + chestHeight * 1.02, chestLeft, chestTop + chestHeight * .44);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(chest, chestLeft, chestTop, chestWidth, chestHeight);
  ctx.restore();

  const headX = sway + .5 * Math.sin(time * 2.1) * happy;
  const headY = -42 + bounce * .80 + breath + 1.8 * offer;
  const angle = tilt + stride * .040 * energy + Math.sin(time * 1.8) * (.012 + .018 * happy);
  const scaleX = 1 + .095 * offer + .012 * happy;
  const scaleY = 1 + .08 * offer;
  const headWidth = HEAD_HEIGHT * ratio(head);
  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(angle);
  ctx.scale(scaleX, scaleY);
  paintHead(ctx, head, headWidth, happy);
  const t = ((time % 4.4) + 4.4) % 4.4;
  const blink = Math.max(blinkAt(t, 1.78, .135), blinkAt(t, 4.02, .103));
  const open = (1 - blink) * (1 - .21 * happy);
  const eyeY = -HEAD_HEIGHT * .442;
  const eyeWidth = headWidth * .113;
  paintEye(ctx, art['pov-clover-eye-left'], -headWidth * .162, eyeY, eyeWidth, open);
  paintEye(ctx, art['pov-clover-eye-right'], headWidth * .148, eyeY, eyeWidth, open);
  ctx.restore();

  const mouthX = -headWidth * .009, mouthY = (MOUTH_LINE - 1) * HEAD_HEIGHT;
  return {
    x: headX + mouthX * scaleX * Math.cos(angle) - mouthY * scaleY * Math.sin(angle),
    y: headY + mouthX * scaleX * Math.sin(angle) + mouthY * scaleY * Math.cos(angle),
  };
}
