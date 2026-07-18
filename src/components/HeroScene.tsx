import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import type { Group } from 'three'
import { mulberry32, type V3 } from '../lib/math'

function Scene() {
  const group = useRef<Group>(null)
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.12
  })

  const { frustum, points } = useMemo(() => {
    const d = 1.6
    const hw = 1.0
    const hh = 0.72
    const corners: V3[] = [
      [-hw, -hh, d],
      [hw, -hh, d],
      [hw, hh, d],
      [-hw, hh, d],
    ]
    const frustum: V3[][] = [...corners.map((c) => [[0, 0, 0] as V3, c]), [...corners, corners[0]]]
    const rand = mulberry32(7)
    const points: V3[] = Array.from({ length: 42 }, () => [
      (rand() - 0.5) * 2.2,
      (rand() - 0.5) * 1.6,
      d + 0.4 + rand() * 2.2,
    ])
    return { frustum, points }
  }, [])

  return (
    <group ref={group} position={[0, 0, 0]} rotation={[0.15, 0, 0]}>
      {frustum.map((pts, i) => (
        <Line key={i} points={pts} color="#22d3ee" lineWidth={1.2} transparent opacity={0.55} />
      ))}
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color={i % 3 === 0 ? '#a78bfa' : '#22d3ee'} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

export default function HeroScene() {
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0.4, -3.2], fov: 50 }}>
      <Scene />
    </Canvas>
  )
}
