import sys
def ship(L):
    for lim,s,u in [(24,'uni','3,3,1'),(30,'rochen','3,3,1'),(36,'hammer','4,3,1'),(45,'zwilling','4,4,1'),(54,'gravitron','4,4,1'),(60,'spektral','4,4,2'),(69,'segler','5,4,2'),(78,'schatten','5,5,2'),(90,'drache','5,5,2'),(100,'omega','5,5,2')]:
        if L<=lim: return s,u
K=int(sys.argv[1]); N=int(sys.argv[2]); runs=sys.argv[3] if len(sys.argv)>3 else '1'
print(' '.join(f"{ship(L)[0]}:{L}:{runs}:{ship(L)[1]}" for L in range(19,101) if (L-19)%N==K))
