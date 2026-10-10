import json,glob,sys
rs=[json.loads(l) for f in sys.argv[1:] for l in open(f) if l.startswith('{')]
by={}
for r in rs: by.setdefault(19+3*((r['L']-19)//3),[]).append(r)
tune={}
for b in sorted(by):
    g=sorted(by[b],key=lambda r:r['L']); w=sum(r['win'] for r in g); al=sum(r['lives'] or 0 for r in g)/len(g)
    act='keep'
    if b==100: act='keep (TUNE_BOSS 1.25 from earlier 8-run sim)'
    elif w==len(g) and al>=5: tune[b]=1.15; act='too easy -> TUNE 1.15'
    elif w<=len(g)-2: tune[b]=0.85; act='too hard -> TUNE 0.85'
    print(b, ' '.join(f"L{r['L']}:{'W' if r['win'] else 'L'}{r['lives']}" for r in g), g[0]['ship'], f"{w}/{len(g)}", round(al,1), act)
json.dump(tune,open('tune_decide.json','w'))
