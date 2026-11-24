import sys, subprocess, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1280, 720, 30
P = 640
PX, PY = 40, 40
K = P / 600.0
SERIF = '/usr/share/fonts/opentype/noto/NotoSerifCJK-Medium.ttc'
UI = '/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc'
UIB = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'

BG = (250, 246, 238)
INK = np.array([34, 34, 38], np.float32)
RED = np.array([20, 148, 214], np.float32)
GHOST = np.array([226, 222, 214], np.float32)
NUMS = '①②③④⑤⑥⑦⑧⑨⑩'

# ---- specs: skeleton paths in 600-space, in stroke order -------------------------------------
SPECS = {
    'ji': dict(
        ch='字',
        paths=[
            [(300, 88), (300, 168)],
            [(123, 128), (120, 185), (100, 222), (80, 243)],
            [(135, 172), (500, 172), (447, 229)],
            [(160, 247), (400, 247), (425, 238), (436, 252), (400, 285), (360, 305), (328, 322)],
            [(300, 310), (300, 525), (280, 547), (250, 545), (190, 520)],
            [(65, 376), (535, 376)],
        ],
        rows=['たてに てん', 'ひだりに てん', 'よこ → みぎで おれる',
              'よこ → ひだりへ はらう', 'たて → ひだりへ はねる', 'よこに ながく ひく'],
        write=[1.0, 1.3, 1.8, 1.8, 1.6, 1.4],
        cross=[(0, 2, (296, 345, 150, 200)), (4, 5, (296, 345, 368, 426))],
        badge={3: (-6, -36)},
    ),
    'sui': dict(
        ch='水',
        paths=[
            [(300, 92), (300, 525), (285, 552), (255, 550), (192, 518)],
            [(68, 241), (205, 241), (228, 243), (215, 300), (150, 420), (95, 480), (58, 514)],
            [(500, 207), (480, 225), (430, 270), (376, 312)],
            [(320, 150), (338, 235), (385, 325), (445, 400), (505, 455), (542, 476)],
        ],
        rows=['たて → ひだりへ はねる', 'よこ → ひだりへ はらう',
              'みぎうえから ひだりへ はらう', 'うえから みぎへ はらう'],
        write=[1.5, 1.8, 1.0, 1.6],
        cross=[],
        badge={},
    ),
    'dai': dict(
        ch='大',
        paths=[
            [(68, 250), (535, 250)],
            [(298, 92), (298, 200), (290, 300), (250, 400), (170, 480), (62, 558)],
            [(312, 258), (335, 335), (400, 430), (470, 500), (540, 525)],
        ],
        rows=['よこに ながく ひく', 'うえから ひだりへ はらう', 'なかから みぎへ はらう'],
        write=[1.4, 1.8, 1.6],
        cross=[(0, 1, (283 / K, 358 / K, 254 / K, 280 / K))],
        badge={},
    ),
    'ame': dict(
        ch='雨',
        paths=[
            [(62, 141), (480, 141), (490, 118)],
            [(115, 205), (115, 550)],
            [(138, 230), (478, 230), (483, 260), (483, 520), (470, 550), (440, 555), (388, 520)],
            [(298, 150), (298, 545)],
            [(163, 278), (215, 295), (245, 335), (240, 350)],
            [(160, 388), (215, 405), (245, 445), (238, 465)],
            [(340, 278), (392, 295), (422, 335), (417, 350)],
            [(340, 388), (392, 405), (422, 445), (417, 465)],
        ],
        rows=['よこに ながく ひく', 'ひだりの たて', 'よこ → たて → はねる', 'まんなかの たて',
              'ひだりうえの てん', 'ひだりしたの てん', 'みぎうえの てん', 'みぎしたの てん'],
        write=[1.3, 1.0, 2.0, 1.3, 0.7, 0.7, 0.7, 0.7],
        cross=[(2, 3, (294 / K, 345 / K, 229 / K, 262 / K))],
        badge={4: (-30, -30), 5: (-30, -30), 6: (-30, -30), 7: (-30, -30)},
    ),
}


from kanji_more import MORE  # noqa: E402
SPECS.update(MORE)


def sample(path, step=1.5):
    pts = []
    for (x0, y0), (x1, y1) in zip(path[:-1], path[1:]):
        n = max(2, int(np.hypot(x1 - x0, y1 - y0) / step))
        for i in range(n):
            u = i / n
            pts.append((x0 + (x1 - x0) * u, y0 + (y1 - y0) * u))
    pts.append(path[-1])
    pts = np.array(pts, dtype=np.float32) * K
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    return pts, seg / seg[-1]


def nearest(pix, pts, tt):
    d = np.empty(len(pix), np.float32)
    ti = np.empty(len(pix), np.float32)
    for s in range(0, len(pix), 4000):
        c = pix[s:s + 4000]
        dd = ((c[:, None, :] - pts[None, :, :]) ** 2).sum(2)
        j = dd.argmin(1)
        d[s:s + 4000] = dd[np.arange(len(c)), j]
        ti[s:s + 4000] = tt[j]
    return d, ti


def build_maps(spec):
    f = ImageFont.truetype(spec.get('font', SERIF), spec.get('size', 520) * K, index=0)
    im = Image.new('L', (P, P), 0)
    ImageDraw.Draw(im).text((P / 2, P / 2), spec.get('glyph', spec['ch']), font=f, fill=255, anchor='mm')
    a = np.asarray(im, dtype=np.float32) / 255.0
    ys, xs = np.nonzero(a > 0.02)
    pix = np.stack([xs, ys], 1).astype(np.float32)
    best = np.full(len(pix), 1e9, np.float32)
    assign = np.full(len(pix), -1, np.int32)
    tpar = np.zeros(len(pix), np.float32)
    samples = [sample(p) for p in spec['paths']]
    for k, (pts, tt) in enumerate(samples):
        d, ti = nearest(pix, pts, tt)
        mk = d < best
        best[mk] = d[mk]
        assign[mk] = k
        tpar[mk] = ti[mk]
    A = np.full((P, P), -1, np.int32)
    T = np.zeros((P, P), np.float32)
    A[ys, xs] = assign
    T[ys, xs] = tpar
    A2 = np.full((P, P), -1, np.int32)
    T2 = np.zeros((P, P), np.float32)
    xx = np.arange(P)[None, :].repeat(P, 0)
    yy = np.arange(P)[:, None].repeat(P, 1)
    for s_, (x0, x1, y0, y1), zero in spec.get('assign', []):
        box = (xx >= x0 * K) & (xx <= x1 * K) & (yy >= y0 * K) & (yy <= y1 * K) & (a > 0.02)
        bx = np.stack([xx[box], yy[box]], 1).astype(np.float32)
        _, t_s = nearest(bx, *samples[s_])
        A[box], T[box] = s_, (0 if zero else t_s)
    for own, sec, (x0, x1, y0, y1) in spec['cross']:
        box = (xx >= x0 * K) & (xx <= x1 * K) & (yy >= y0 * K) & (yy <= y1 * K) & (a > 0.02)
        bx = np.stack([xx[box], yy[box]], 1).astype(np.float32)
        _, t_own = nearest(bx, *samples[own])
        _, t_sec = nearest(bx, *samples[sec])
        A[box], T[box] = own, t_own
        A2[box], T2[box] = sec, t_sec
    return a, A, T, A2, T2


def fonts(n):
    big = n <= 6
    return dict(
        T=ImageFont.truetype(UIB, 50, index=0),
        S=ImageFont.truetype(UI, 26, index=0),
        R=ImageFont.truetype(UI, 31 if big else 27, index=0),
        N=ImageFont.truetype(UIB, 26 if big else 24, index=0),
        C=ImageFont.truetype(UIB, 34, index=0),
    )


def base_img():
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([PX - 6, PY - 6, PX + P + 6, PY + P + 6], 14, fill=(255, 255, 255), outline=(205, 198, 186), width=3)
    c = (160, 205, 230)
    for t in range(0, P, 16):
        d.line([(PX + P // 2, PY + t), (PX + P // 2, PY + min(t + 8, P))], fill=c, width=2)
        d.line([(PX + t, PY + P // 2), (PX + min(t + 8, P), PY + P // 2)], fill=c, width=2)
    return im


def right_panel(spec, state, F):
    rows, n = spec['rows'], len(spec['rows'])
    pitch = min(68, int((H - 192 - 80) / n))
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0 = 740
    d.text((x0, 58), f"「{spec['ch']}」の書き順", font=F['T'], fill=(34, 34, 38))
    d.text((x0, 128), f'全{n}画  ・  青い線が いま書いている画', font=F['S'], fill=(110, 104, 96))
    y = 192 if n <= 6 else 184
    for i, t in enumerate(rows):
        cur, done = state == i, state > i
        if cur:
            d.rounded_rectangle([x0 - 14, y - 6, W - 40, y + pitch - 14], 14, fill=(219, 238, 250))
        col = (20, 148, 214) if cur else ((34, 34, 38) if done else (170, 164, 156))
        d.text((x0, y + 4), NUMS[i], font=F['N'], fill=col)
        fs = F['R'].size
        fr = F['R']
        while fr.getlength(t) > (W - 40 - 12) - (x0 + 48) and fs > 18:
            fs -= 1
            fr = ImageFont.truetype(UI, fs, index=0)
        d.text((x0 + 48, y + 3 + (F['R'].size - fs) // 2), t, font=fr, fill=col)
        y += pitch
    if state == n:
        d.text((x0, y + 10), 'できあがり!', font=F['C'], fill=(20, 148, 214))
    return im


class Maker:
    def __init__(self, key):
        self.spec = SPECS[key]
        self.n = len(self.spec['paths'])
        self.a, self.A, self.T, self.A2, self.T2 = build_maps(self.spec)
        self.F = fonts(self.n)
        self.base = np.asarray(base_img(), dtype=np.float32)
        self.RP = {s: right_panel(self.spec, s, self.F) for s in range(-1, self.n + 1)}

    def frame(self, c, u):
        a, A, T, A2, T2 = self.a, self.A, self.T, self.A2, self.T2
        out = self.base.copy()
        reg = out[PY:PY + P, PX:PX + P]
        al = a[..., None]
        reg[:] = reg * (1 - al) + GHOST * al
        if 0 <= c < self.n:
            dark = (A >= 0) & (A < c)
            red = (((A == c) & (T <= u)) | ((A2 == c) & (T2 <= u))) & ~dark
        else:
            dark = (A >= 0) if c >= self.n else np.zeros(A.shape, bool)
            red = np.zeros(A.shape, bool)
        for mask, col in ((dark, INK), (red, RED)):
            mm = (mask.astype(np.float32) * a)[..., None]
            reg[:] = reg * (1 - mm) + col * mm
        im = Image.fromarray(out.astype(np.uint8)).convert('RGBA')
        im.alpha_composite(self.RP[c])
        if 0 <= c < self.n:
            d = ImageDraw.Draw(im)
            sx, sy = self.spec['paths'][c][0]
            ox, oy = self.spec['badge'].get(c, (-34, -26))
            bx, by = PX + sx * K + ox, PY + sy * K + oy
            d.ellipse([bx - 17, by - 17, bx + 17, by + 17], fill=(20, 148, 214))
            d.text((bx, by - 1), str(c + 1), font=self.F['N'], fill=(255, 255, 255), anchor='mm')
        return np.asarray(im.convert('RGB'))

    def timeline(self):
        ease = lambda x: x * x * (3 - 2 * x)
        quick = self.spec.get('quick')
        seq = [(-1, 0.0)] * int((1.0 if quick else 1.5) * FPS)
        for k in range(self.n):
            m = int(self.spec['write'][k] * FPS)
            seq += [(k, ease((i + 1) / m) * 1.03) for i in range(m)]
            seq += [(k, 1.03)] * int((0.6 if quick else 1.0) * FPS)
        seq += [(self.n, 1.0)] * int((2.0 if quick else 3.0) * FPS)
        return seq

    def render(self, out):
        tmp = out.replace('.mp4', '.part.mp4')
        p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                              '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-crf', '18',
                              '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp],
                             stdin=subprocess.PIPE)
        last, buf = None, None
        for st, u in self.timeline():
            if (st, u) != last:
                buf = self.frame(st, u).tobytes()
                last = (st, u)
            p.stdin.write(buf)
        p.stdin.close()
        if p.wait() == 0:
            os.rename(tmp, out)
            print('done', out)


if __name__ == '__main__':
    mode, key = sys.argv[1], sys.argv[2]
    mk = Maker(key)
    if mode == 'test':
        n = mk.n
        # a few moments with the most on screen: mid-stroke of the busiest strokes, plus the finished frame
        picks = {'ame': [(2, 0.6), (5, 0.6), (8, 1.0)], 'sui': [(1, 0.5), (3, 0.6), (4, 1.0)],
                 'dai': [(1, 0.5), (2, 0.6), (3, 1.0)], 'ji': [(2, 0.5), (3, 0.7), (6, 1.0)]}[key]
        for i, (st, u) in enumerate(picks):
            Image.fromarray(mk.frame(st, u)).save(f't_{key}_{i}.png')
        # assignment map for checking
        cols = np.array([(230, 60, 60), (60, 160, 60), (60, 60, 230), (200, 150, 0), (160, 60, 200),
                         (0, 170, 170), (120, 120, 0), (200, 80, 160)], np.uint8)
        img = np.full((P, P, 3), 255, np.uint8)
        mm = mk.A >= 0
        img[mm] = cols[mk.A[mm] % 8]
        Image.fromarray(img).save(f'assign_{key}.png')
    else:
        mk.render(sys.argv[3])
