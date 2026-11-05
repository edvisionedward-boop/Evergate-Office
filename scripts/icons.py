from PIL import Image, ImageDraw, ImageFilter
import math
def icon(S, path, pad=0):
    im = Image.new('RGBA',(S,S),(0,0,0,0))
    d = ImageDraw.Draw(im)
    # background gradient
    bg = Image.new('RGB',(S,S))
    for y in range(S):
        t=y/S
        c=(int(10+12*t),int(16+10*t),int(32+20*t))
        ImageDraw.Draw(bg).line([(0,y),(S,y)],fill=c)
    mask=Image.new('L',(S,S),0)
    ImageDraw.Draw(mask).rounded_rectangle([0,0,S-1,S-1],radius=int(S*0.22) if pad==0 else 0,fill=255)
    im.paste(bg,(0,0),mask)
    # glow
    glow=Image.new('RGBA',(S,S),(0,0,0,0))
    g=ImageDraw.Draw(glow)
    cx,cy=S/2,S*0.53
    g.ellipse([cx-S*0.33,cy-S*0.12,cx+S*0.33,cy+S*0.2],fill=(34,211,238,120))
    glow=glow.filter(ImageFilter.GaussianBlur(S*0.06))
    im.alpha_composite(glow)
    d=ImageDraw.Draw(im)
    r=S*0.26
    def p(a,rr=r,oy=0): return (cx+rr*math.cos(a), cy-S*0.06+oy+rr*0.58*math.sin(a))
    top=[p(-math.pi/2),p(0),p(math.pi/2),p(math.pi)]
    h=S*0.22
    left=[p(math.pi),p(math.pi/2),(p(math.pi/2)[0],p(math.pi/2)[1]+h),(p(math.pi)[0],p(math.pi)[1]+h)]
    right=[p(0),p(math.pi/2),(p(math.pi/2)[0],p(math.pi/2)[1]+h),(p(0)[0],p(0)[1]+h)]
    d.polygon(left,fill=(14,116,144))
    d.polygon(right,fill=(8,74,100))
    d.polygon(top,fill=(34,211,238))
    # gate on top face
    gx,gy=cx,cy-S*0.06
    mid=lambda a,b:((a[0]+b[0])/2,(a[1]+b[1])/2)
    w=max(2,S//36)
    d.line([mid(top[0],top[1]),mid(top[2],top[3])],fill=(8,40,60),width=w)
    d.line([mid(top[1],top[2]),mid(top[3],top[0])],fill=(8,40,60),width=w)
    # three dots status
    for i,c in enumerate([(34,197,94),(245,158,11),(236,72,153)]):
        x=cx-S*0.12+i*S*0.12; y=S*0.84
        d.ellipse([x-S*0.03,y-S*0.03,x+S*0.03,y+S*0.03],fill=c)
    im.save(path)
icon(512,'public/icons/icon-512.png')
icon(192,'public/icons/icon-192.png')
icon(180,'public/icons/apple-touch-icon.png',pad=1)
icon(512,'public/icons/maskable-512.png',pad=1)
icon(64,'public/icons/favicon.png')
