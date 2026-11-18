import sys, os, subprocess
import gen, allspecs
specs = allspecs.all_specs()
gen.SPECS.update(specs)
names = {}
HIRA='あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'
KATA='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
ROM='a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ha hi fu he ho ma mi mu me mo ya yu yo ra ri ru re ro wa wo n'.split()
for c,r in zip(HIRA,ROM): names[c]='h_'+r
for c,r in zip(KATA,ROM): names[c]='k_'+r
for d in '0123456789': names[d]='n_'+d
part=int(sys.argv[1]); parts=int(sys.argv[2])
keys=list(names)
os.makedirs('site/videos',exist_ok=True)
for i,k in enumerate(keys):
    if i%parts!=part: continue
    out=f'site/videos/{names[k]}.mp4'
    if os.path.exists(out): continue
    mk=gen.Maker(k); mk.render(out); print('ok',k,out,flush=True)
