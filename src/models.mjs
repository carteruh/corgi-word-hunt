import * as T from 'three';

const up = new T.Vector3(0, 1, 0);
const turn = Math.PI * 2;

// Petal color, petal count, length, half-width and the height of the tips.
export const varieties = [
  ['#e94c43', 8, .45, .161, .105], ['#f4cd36', 11, .41, .073, .075],
  ['#e875ac', 8, .41, .144, .12],  ['#9476d1', 7, .35, .123, .17],
  ['#ec822c', 5, .25, .181, .34],  ['#fff2d7', 10, .40, .093, .07],
  ['#cd364c', 6, .40, .189, .16],  ['#b7cc3b', 9, .40, .101, .085],
  ['#64b9d3', 5, .33, .164, .12],  ['#ef8e81', 5, .24, .159, .35],
  ['#be61bc', 8, .40, .134, .12],  ['#f2a33a', 7, .40, .161, .17],
];

// Bake a model's colored facets into one mesh. Copies of the same variety share it.
class Parts {
  positions = [];
  colors = [];

  add(shape, color, at = [0,0,0], scale = [1,1,1], rotation = [0,0,0]) {
    const g = shape.index ? shape.toNonIndexed() : shape;
    const xyz = g.getAttribute('position'), tint = g.getAttribute('color');
    const c = new T.Color(color);
    const q = rotation.isQuaternion ? rotation : new T.Quaternion().setFromEuler(new T.Euler(...rotation));
    const matrix = new T.Matrix4().compose(new T.Vector3(...at), q, new T.Vector3(...scale));
    const v = new T.Vector3();
    for (let i = 0; i < xyz.count; i++) {
      v.fromBufferAttribute(xyz, i).applyMatrix4(matrix);
      this.positions.push(v.x, v.y, v.z);
      if (tint) this.colors.push(c.r*tint.getX(i), c.g*tint.getY(i), c.b*tint.getZ(i));
      else this.colors.push(c.r,c.g,c.b);
    }
  }

  ball(color, at, scale, segments = 8) {
    this.add(new T.SphereGeometry(1, segments, 5), color, at, scale);
  }

  rod(color, a, b, r1, r2 = r1) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b);
    const dir = end.clone().sub(start);
    const mid = start.add(end).multiplyScalar(.5);
    const rotation = new T.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    this.add(new T.CylinderGeometry(r2,r1,dir.length(),5),color,mid.toArray(),[1,1,1],rotation);
  }

  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.colors, 3));
    g.computeVertexNormals();
    return g;
  }
}

// A folded center and narrow colored edge stay legible when a flower faces away from the light.
function blade(outline, ridge, glazes, edge = .47) {
  const positions = [], colors = [];
  const inner = outline.map(p => p.map((n, j) => n * .965 + ridge[j] * .035));
  function face(a, b, c, shade) {
    positions.push(...a,...b,...c);
    for (let n=0;n<3;n++) colors.push(shade,shade,shade);
  }
  for (let i=0; i<outline.length; i++) {
    const next = (i + 1) % outline.length;
    face(ridge,inner[i],inner[next],glazes[i % glazes.length]);
    face(inner[i],outline[i],outline[next],edge);
    face(inner[i],outline[next],inner[next],edge);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  return g;
}

const leaf = blade([
  [0,0,0],[-.091,.064,.125],[-.153,.135,.31],[-.122,.235,.48],
  [-.012,.32,.67],[.109,.20,.47],[.142,.135,.28],[.076,.055,.115],
], [0,.207,.315], [.65,.76,.81,.86,.99,1,.95,.90], .44);

function foliage(parts, position, angle, size, color) {
  parts.add(leaf,color,position,[size,size,size],[0,angle,0]);
}

export function flowerModel(kind) {
  const [color, petalCount, length, width, lift] = varieties[kind];
  const plant = new Parts(), bloom = new Parts();
  const height = .94 + (kind % 4)*.089 + (kind === 1 ? .15 : 0);
  const bend = Math.sin(kind*2.3+.8)*.10;
  const top = [bend,height,.028*Math.sin(kind)];
  plant.rod('#346948',[0,0,0],[.036,height*.51,.018],.026,.022);
  plant.rod('#437b4a',[.036,height*.51,.018],top,.022,.017);
  const leafAngle = 1.22 + Math.sin(kind)*.3;
  foliage(plant,[.015,height*.24,0],leafAngle,.91,'#316b42');
  foliage(plant,[.034,height*.48,.019],leafAngle-2.88,.75,'#3e804a');
  if (kind%2===0) foliage(plant,[bend*.58,height*.66,.015],2.79,.47,'#4d8749');

  const cup = kind===4 || kind===9;
  const outline = cup ? [
    [0,0,0],[-.61,.18,.29],[-.96,.57,.71],[-.60,.87,.91],[0,1.16,.99],
    [.59,.88,.92],[.99,.52,.70],[.55,.18,.23],
  ] : [
    [0,0,0],[-.51,.08,.22],[-.90,.44,.55],[-1,.82,.80],[-.64,1.03,.98],
    [0,1.06,1.04],[.67,.96,.97],[1,.69,.76],[.81,.38,.52],[.46,.10,.21],
  ];
  const petal = blade(outline.map(([x,y,z])=>[x*width,y*lift,z*length]),
    [0,lift*.59+.023,length*.56], [.84,.89,.95,.98,1.04,1.03,.98,.93,.87,.85], .54);
  for (let i=0; i<petalCount; i++) {
    const angle = turn*i/petalCount + .032*Math.sin(i*4+kind);
    const tint = new T.Color(color).multiplyScalar(.93+.07*Math.cos(i*2.7));
    bloom.add(petal,tint,[.02*Math.sin(angle),0,.02*Math.cos(angle)],
      [1,1,1+.057*Math.sin(i*2+kind)],[0,angle,0]);
  }
  const pollen = kind===6 ? '#f6bb49' : '#ffcf4f';
  bloom.ball(cup?'#d89945':'#bf8b36',[0,.046,0],[.097,.048,.097]);
  bloom.ball(pollen,[0,.068,0],[.091,.051,.091]);
  if (!cup) {
    bloom.ball('#ffe99a',[-.025,.110,.017],[.027,.012,.019],6);
    bloom.ball('#ffe38a',[.023,.110,-.023],[.014,.009,.012],5);
  }
  plant.add(bloom.geometry(),'#ffffff',top,[1,1,1],
    [.42 + (kind%4)*.134,kind*.16,kind%2?.13:-.12]);

  if (cup || kind===2) {
    const side = kind%2 ? -1 : 1;
    const bud = [side*.24,height*.77,-.09];
    plant.rod('#42764a',[.024,height*.47,.008],bud,.018,.011);
    foliage(plant,bud,side*1.64,.20,'#387548');
    plant.add(new T.IcosahedronGeometry(1,0),color,
      [bud[0]+side*.033,bud[1]+.083,bud[2]],[.077,.134,.074],[0,.2,-side*.32]);
  }
  return plant.geometry();
}

const grassBlade = new T.BufferGeometry();
grassBlade.setAttribute('position',new T.Float32BufferAttribute([
  -.021,0,0,      .020,0,0,       .007,.083,.011,
   .007,.083,.011,.020,0,0,       .035,.080,.021,
   .007,.083,.011,.035,.080,.021, .069,.167,.046,
],3));
const grassTints = ['#5e7845','#68824d','#769152','#859a5b','#94a369'];
const cloverTints = ['#799957','#678748','#86a360'];

export function meadowGrass(random = Math.random) {
  const grass = new Parts();
  for (let i=0; i<260; i++) {
    const cx=(random()-.5)*15, cz=(random()-.5)*12;
    const spin=random()*turn, count=2+Math.floor(random()*4);
    const clover = i%10===0;
    const shape = clover ? leaf : grassBlade;
    const palette = clover ? cloverTints : grassTints;
    for (let j=0; j<count; j++) {
      const angle=spin+turn*j/count+(random()-.5)*.6;
      const x=cx+Math.cos(angle)*random()*.061, z=cz+Math.sin(angle)*random()*.055;
      const size=(clover?.135:.68)*(.60+random()*.80);
      const color=palette[Math.floor(random()*palette.length)];
      grass.add(shape,color,[x,.001,z],[size,size,size],[0,angle,0]);
    }
  }
  return grass.geometry();
}
