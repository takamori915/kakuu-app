import sys
from PIL import Image, ImageDraw, ImageFont
SERIF='/usr/share/fonts/opentype/noto/NotoSerifCJK-Medium.ttc'
SANS='/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc'
HIRA='あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'
KATA='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
S=480; K=S/600
lab=ImageFont.truetype(SANS,40,index=0); tick=ImageFont.truetype(SANS,14,index=0)
def cell(ch,fontpath):
    f=ImageFont.truetype(fontpath,520*K,index=0)
    im=Image.new('RGB',(S,S),'white'); d=ImageDraw.Draw(im)
    for v in range(0,601,50):
        c=(255,120,120) if v%100==0 else (255,205,205)
        d.line([(v*K,0),(v*K,S)],fill=c); d.line([(0,v*K),(S,v*K)],fill=c)
        if v%100==0 and v>0:
            d.text((v*K+2,2),str(v),font=tick,fill=(200,0,0)); d.text((2,v*K+2),str(v),font=tick,fill=(200,0,0))
    g=Image.new('L',(S,S),0); ImageDraw.Draw(g).text((S/2,S/2),ch,font=f,fill=255,anchor='mm')
    im.paste((70,70,70),mask=g.point(lambda p:int(p*0.8)))
    d.text((S-60,4),ch,font=lab,fill=(0,0,200))
    d.rectangle([0,0,S-1,S-1],outline=(120,120,120))
    return im
def sheet(chars,fontpath,out):
    cols=3; rows=(len(chars)+cols-1)//cols
    im=Image.new('RGB',(S*cols,S*rows),'white')
    for i,ch in enumerate(chars):
        im.paste(cell(ch,fontpath),((i%cols)*S,(i//cols)*S))
    im.save(out)
for name,s in (('h',HIRA),('k',KATA)):
    for i in range(0,len(s),6):
        sheet(list(s[i:i+6]),SERIF,f'sheets/{name}{i//6+1:02d}.png')
sheet(list('0123456789'[:6]),SANS,'sheets/d1.png'); sheet(list('6789'),SANS,'sheets/d2.png')
