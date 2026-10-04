#!/bin/bash
# usage: stat.sh <name> <startFrame>
N=$1; S=${2:-18}; rm -rf ${N}_b; mkdir ${N}_b
for f in ${N}_f10/f_*.png; do i=$((10#$(basename $f .png | cut -d_ -f2))); [ $i -ge $S ] && cp $f ${N}_b/; done
echo -n "$N: "; node vidmotion.cjs ${N}_b 10 10 25 | tail -1
