import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Group } from 'three'
import { mulberry32, type V3 } from '../lib/math'

/**
 * Hero: a constellation of the site's seven tracks - camera frustum (vision),
 * scatter+PCA (data), neural net (ML), gaussian (math), sine wave (signals),
 * robot arm (robotics), laser triangulation fan (metrology) - orbiting a core.
 */

const CYAN = '#22d3ee'
const VIOLET = '#a78bfa'
const AMBER = '#fbbf24'
const GREEN = '#4ade80'
const RED = '#f87171'

// ---- motif geometry (all centered near origin, ~0.7 units across) ----

function frustumLines(): { pts: V3[]; color: string }[] {
  const d = 0.5
  const hw = 0.3
  const hh = 0.22
  const c: V3[] = [
    [-hw, -hh, d],
    [hw, -hh, d],
    [hw, hh, d],
    [-hw, hh, d],
  ]
  return [
    ...c.map((p) => ({ pts: [[0, 0, 0] as V3, p], color: CYAN })),
    { pts: [...c, c[0]], color: CYAN },
  ]
}

function sineLines(): { pts: V3[]; color: string }[] {
  const wave: V3[] = Array.from({ length: 40 }, (_, i) => {
    const x = -0.35 + (0.7 * i) / 39
    return [x, 0.16 * Math.sin(x * 14), 0]
  })
  return [
    { pts: wave, color: AMBER },
    { pts: [[-0.38, 0, 0], [0.38, 0, 0]], color: '#8b93a7' },
  ]
}

function gaussLines(): { pts: V3[]; color: string }[] {
  const bell: V3[] = Array.from({ length: 36 }, (_, i) => {
    const x = -0.35 + (0.7 * i) / 35
    return [x, 0.38 * Math.exp(-(x * x) / 0.02) - 0.08, 0]
  })
  return [
    { pts: bell, color: GREEN },
    { pts: [[-0.38, -0.08, 0], [0.38, -0.08, 0]], color: '#8b93a7' },
  ]
}

function armLines(): { pts: V3[]; color: string }[] {
  const elbow: V3 = [0.22, 0.18, 0]
  const tip: V3 = [0.42, -0.02, 0]
  return [
    { pts: [[-0.12, -0.22, 0], elbow], color: VIOLET },
    { pts: [elbow, tip], color: CYAN },
    // gripper fingers
    { pts: [tip, [0.5, 0.05, 0]], color: CYAN },
    { pts: [tip, [0.52, -0.08, 0]], color: CYAN },
  ]
}

function laserLines(): { pts: V3[]; color: string }[] {
  const apex: V3 = [0, 0.32, 0]
  // surface profile with a bump - what the laser line measures
  const prof: V3[] = Array.from({ length: 24 }, (_, i) => {
    const x = -0.3 + (0.6 * i) / 23
    return [x, -0.18 + 0.1 * Math.exp(-(x * x) / 0.008), 0]
  })
  const rays = [-0.26, -0.13, 0, 0.13, 0.26].map((x) => ({
    pts: [apex, [x, -0.18 + 0.1 * Math.exp(-(x * x) / 0.008), 0] as V3],
    color: RED,
  }))
  return [...rays, { pts: prof, color: CYAN }]
}

interface Node3 {
  p: V3
  color: string
}

function nnMotif(): { lines: { pts: V3[]; color: string }[]; nodes: Node3[] } {
  const layers = [3, 4, 2]
  const nodes: Node3[] = []
  const perLayer: V3[][] = layers.map((n, li) => {
    const x = -0.28 + li * 0.28
    return Array.from({ length: n }, (_, i) => [x, (i - (n - 1) / 2) * 0.19, 0] as V3)
  })
  perLayer.forEach((layer, li) => layer.forEach((p) => nodes.push({ p, color: li === 1 ? VIOLET : CYAN })))
  const lines: { pts: V3[]; color: string }[] = []
  for (let li = 0; li < perLayer.length - 1; li++)
    for (const a of perLayer[li]) for (const b of perLayer[li + 1]) lines.push({ pts: [a, b], color: VIOLET })
  return { lines, nodes }
}

function scatterMotif(): { lines: { pts: V3[]; color: string }[]; nodes: Node3[] } {
  const rand = mulberry32(11)
  const nodes: Node3[] = Array.from({ length: 16 }, () => {
    const a = (rand() - 0.5) * 0.72
    const b = (rand() - 0.5) * 0.2
    return { p: [a * 0.86 - b * 0.5, a * 0.5 + b * 0.86, 0] as V3, color: CYAN }
  })
  // PC1 arrow along the cloud's major axis
  const lines = [
    { pts: [[-0.31, -0.18, 0], [0.31, 0.18, 0]] as V3[], color: GREEN },
    { pts: [[0.31, 0.18, 0], [0.22, 0.17, 0]] as V3[], color: GREEN },
    { pts: [[0.31, 0.18, 0], [0.27, 0.08, 0]] as V3[], color: GREEN },
  ]
  return { lines, nodes }
}

// ---- scene ----

const RING_R = 1.75

function Motif({ index, children }: { index: number; children: React.ReactNode }) {
  const ref = useRef<Group>(null)
  const angle = (index / 7) * Math.PI * 2
  const baseY = index % 2 === 0 ? 0.3 : -0.32
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.position.y = baseY + 0.06 * Math.sin(t * 0.7 + index * 1.8)
    // keep each motif gently swiveling so it never degenerates to an edge-on line
    ref.current.rotation.y = -angle + 0.35 * Math.sin(t * 0.25 + index)
  })
  return (
    <group ref={ref} position={[RING_R * Math.cos(angle), baseY, RING_R * Math.sin(angle)]}>
      {children}
    </group>
  )
}

function Core() {
  const ref = useRef<Group>(null)
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y -= delta * 0.25
    ref.current.rotation.x += delta * 0.11
  })
  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial color={CYAN} wireframe transparent opacity={0.6} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color={VIOLET} wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

function Scene() {
  const group = useRef<Group>(null)
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.09
  })

  const { motifs, spokes, dust, nn, scatter } = useMemo(() => {
    const motifs = [frustumLines(), sineLines(), gaussLines(), armLines(), laserLines()]
    const spokes: V3[][] = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2
      const y = i % 2 === 0 ? 0.3 : -0.32
      return [
        [0.34 * Math.cos(a), 0.1 * Math.sign(y), 0.34 * Math.sin(a)],
        [(RING_R - 0.45) * Math.cos(a), y * 0.85, (RING_R - 0.45) * Math.sin(a)],
      ]
    })
    const rand = mulberry32(7)
    const dust: V3[] = Array.from({ length: 60 }, () => {
      const a = rand() * Math.PI * 2
      const r = 0.8 + rand() * 1.4
      return [r * Math.cos(a), (rand() - 0.5) * 1.5, r * Math.sin(a)]
    })
    return { motifs, spokes, dust, nn: nnMotif(), scatter: scatterMotif() }
  }, [])

  // ring order: frustum, scatter, nn, gauss, sine, arm, laser
  const lineMotifs: { idx: number; lines: { pts: V3[]; color: string }[] }[] = [
    { idx: 0, lines: motifs[0] }, // vision
    { idx: 3, lines: motifs[2] }, // math (gauss)
    { idx: 4, lines: motifs[1] }, // signals (sine)
    { idx: 5, lines: motifs[3] }, // robotics (arm)
    { idx: 6, lines: motifs[4] }, // metrology (laser)
  ]

  return (
    <group ref={group} rotation={[0.14, 0, 0]}>
      <Core />
      {spokes.map((pts, i) => (
        <Line key={`s${i}`} points={pts} color={CYAN} lineWidth={0.8} transparent opacity={0.14} />
      ))}
      {lineMotifs.map(({ idx, lines }) => (
        <Motif key={idx} index={idx}>
          {lines.map((l, i) => (
            <Line key={i} points={l.pts} color={l.color} lineWidth={1.1} transparent opacity={0.65} />
          ))}
        </Motif>
      ))}
      <Motif index={1}>
        {scatter.lines.map((l, i) => (
          <Line key={i} points={l.pts} color={l.color} lineWidth={1.2} transparent opacity={0.75} />
        ))}
        {scatter.nodes.map((n, i) => (
          <mesh key={i} position={n.p}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color={n.color} transparent opacity={0.75} />
          </mesh>
        ))}
      </Motif>
      <Motif index={2}>
        {nn.lines.map((l, i) => (
          <Line key={i} points={l.pts} color={l.color} lineWidth={0.7} transparent opacity={0.3} />
        ))}
        {nn.nodes.map((n, i) => (
          <mesh key={i} position={n.p}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshBasicMaterial color={n.color} transparent opacity={0.85} />
          </mesh>
        ))}
      </Motif>
      {dust.map((p, i) => (
        <mesh key={`d${i}`} position={p}>
          <sphereGeometry args={[0.013, 6, 6]} />
          <meshBasicMaterial color={i % 3 === 0 ? VIOLET : CYAN} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

export default function HeroScene() {
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0.55, -3.4], fov: 52 }}>
      {/* world −x appears screen-right for this camera: keep the constellation clear of the headline */}
      <group position={[-0.85, 0, 0]}>
        <Scene />
      </group>
    </Canvas>
  )
}
