set -e
g(){ curl -s -o "$1" "$2"; echo "$1 $(stat -f%z "$1")"; }
g img/hero.png https://v3b.fal.media/files/b/0aae3f0d/XVtnEAEZYS2FGzacX4tmF_ZazsobzO.png
g img/front.png https://v3b.fal.media/files/b/0aae3f12/AAvaGIFe_MRRET12xZxDF_fDXBPzRQ.png
g img/back.png https://v3b.fal.media/files/b/0aae3f12/Pq2oQFYln3UQSlwPkBPlu_RawRm0xc.png
g img/left.png https://v3b.fal.media/files/b/0aae3f12/Dg57K3f5VjvzqTPVgAQy5_oNJZSb0r.png
g img/right.png https://v3b.fal.media/files/b/0aae3f17/QEJBjYWB6ZwQDqXIKGPKL_CAR_Hypercar_RIGHT.png
g img/s1grey.png https://miro-packs.seanwinters.app/m/2026-10/hmzoUmXaJQLq0QNXJCRnmw.png
g img/key_v1.png https://v3b.fal.media/files/b/0aae3f59/HsN-ohc8S_qAii4zbMSii_1yx5W6sc.png
g img/key_a.png https://v3b.fal.media/files/b/0aae3f72/x7qZOUuiPz9IcvrQns2l-_UMfnUx8P.png
g img/key_b.jpg https://v3b.fal.media/files/b/0aae3f74/3QJnfPp59kdBtp4LH9aPh_lEDZSmLW.jpg
g img/key_c.jpg https://v3b.fal.media/files/b/0aae3f76/BwM-FU0h1zZrJGATGXULD_da9d2133e4024e1dbb9ff3fd69c9835c.jpg
g car.glb https://v3b.fal.media/files/b/0aae3f3e/o0tLkpx-Efm3qT5FP4sRX_model.glb
g vid/s1g.mp4 https://miro-packs.seanwinters.app/m/2026-10/QPgjoXq6llcXz_FeVdaNIA.mp4
g vid/s2g.mp4 https://miro-packs.seanwinters.app/m/2026-10/FeQ2VVZJgK4kFGm7msx7FQ.mp4
g vid/s3g.mp4 https://miro-packs.seanwinters.app/m/2026-10/unEKemiexCIKTJtpN4FftA.mp4
cp /path/to/your/vid/s1v.mp4 vid/s1v.mp4   # local AI clip
cp /path/to/your/vid/s2v.mp4 vid/s2v.mp4   # local AI clip
cp /path/to/your/vid/s3v.mp4 vid/s3v.mp4   # local AI clip
cp /path/to/final.mp4 vid/promo.mp4   # finished piece
cp /path/to/board.svg board.svg   # canvas_read_as_svg export
for v in s1g s2g s3g s1v s2v s3v promo; do mkdir -p frames/$v; ffmpeg -v error -y -i vid/$v.mp4 -vf "fps=24,scale=960:-2" -q:v 3 frames/$v/%04d.jpg; echo "$v $(ls frames/$v | wc -l) frames"; done
for f in img/*.png img/*.jpg; do sips -Z 1600 -s format jpeg -s formatOptions 85 "$f" --out "${f%.*}.web.jpg" >/dev/null; done
ls img
