import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Grid, Html, Line, OrbitControls } from '@react-three/drei'
import {
  cameraCenter,
  pixelToWorld,
  projectPoint,
  m3T,
  m4MulP,
  add,
  scale,
  type Intrinsics,
  type Pose,
  type M4,
  type V3,
} from '../../lib/math'

export const AXIS_COLORS = { x: '#f87171', y: '#4ade80', z: '#60a5fa' }

// ---------------------------------------------------------------- scene shell

interface Scene3DProps {
  children: ReactNode
  camera?: { position: V3; fov?: number }
  target?: V3
  height?: number
  hint?: string
  ground?: boolean
  className?: string
}

/** Standard dark 3D viewport: lights, ground grid, orbit controls. */
export function Scene3D({
  children,
  camera = { position: [3, 2.2, 4], fov: 42 },
  target = [0, 0.5, 0],
  height = 420,
  hint,
  ground = true,
  className = '',
}: Scene3DProps) {
  return (
    <div className={`card relative overflow-hidden ${className}`} style={{ height }}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: camera.position, fov: camera.fov ?? 42, near: 0.05, far: 100 }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 7, 3]} intensity={1.4} />
        <directionalLight position={[-5, 4, -4]} intensity={0.4} />
        {ground && (
          <Grid
            args={[24, 24]}
            cellSize={0.25}
            sectionSize={1}
            infiniteGrid
            fadeDistance={14}
            fadeStrength={2}
            cellColor="#1c2435"
            sectionColor="#2b3550"
          />
        )}
        <OrbitControls
          makeDefault
          target={target}
          enableDamping
          dampingFactor={0.12}
          maxPolarAngle={Math.PI * 0.495}
          minDistance={0.5}
          maxDistance={20}
        />
        {children}
      </Canvas>
      {hint && (
        <div className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-black/50 px-2 py-0.5 text-[11px] text-muted backdrop-blur-sm">
          {hint}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- primitives

export function Polyline({
  points,
  color,
  lineWidth = 1.5,
  dashed = false,
  opacity = 1,
}: {
  points: V3[]
  color: string
  lineWidth?: number
  dashed?: boolean
  opacity?: number
}) {
  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      dashed={dashed}
      dashSize={0.04}
      gapSize={0.03}
      transparent={opacity < 1}
      opacity={opacity}
    />
  )
}

/** Filled quad from 4 corners (two triangles, double-sided). */
export function Quad({ corners, color, opacity = 0.1 }: { corners: V3[]; color: string; opacity?: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const [a, b, c, d] = corners
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3),
    )
    g.computeVertexNormals()
    return g
  }, [corners])
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

/** Cylinder between two points (robot links, tripods…). */
export function SegmentMesh({
  from,
  to,
  radius = 0.03,
  color = '#94a3b8',
}: {
  from: V3
  to: V3
  radius?: number
  color?: string
}) {
  const { mid, quat, len } = useMemo(() => {
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    const len = dir.length()
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    )
    const mid = new THREE.Vector3((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2)
    return { mid, quat, len }
  }, [from, to])
  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[radius, radius, len, 20]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
    </mesh>
  )
}

/** RGB coordinate-frame axes for a pose given as row-major 4x4. */
export function AxesTriad({
  pose,
  size = 0.22,
  label,
  labelColor = '#e6eaf2',
  lineWidth = 2.5,
}: {
  pose: M4
  size?: number
  label?: string
  labelColor?: string
  lineWidth?: number
}) {
  const o = m4MulP(pose, [0, 0, 0])
  const x = m4MulP(pose, [size, 0, 0])
  const y = m4MulP(pose, [0, size, 0])
  const z = m4MulP(pose, [0, 0, size])
  return (
    <group>
      <Line points={[o, x]} color={AXIS_COLORS.x} lineWidth={lineWidth} />
      <Line points={[o, y]} color={AXIS_COLORS.y} lineWidth={lineWidth} />
      <Line points={[o, z]} color={AXIS_COLORS.z} lineWidth={lineWidth} />
      {label && (
        <Html position={[o[0], o[1] + size * 0.55, o[2]]} center zIndexRange={[50, 0]}>
          <div className="frame-label" style={{ color: labelColor, borderColor: labelColor }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

/** Dashed connection between two frames with a label at the midpoint (transform arrows). */
export function FrameLink({
  from,
  to,
  color,
  label,
}: {
  from: V3
  to: V3
  color: string
  label?: string
}) {
  const mid: V3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]
  return (
    <group>
      <Polyline points={[from, to]} color={color} dashed lineWidth={1.8} />
      {label && (
        <Html position={mid} center zIndexRange={[40, 0]}>
          <div className="frame-label" style={{ color, borderColor: color }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---------------------------------------------------------------- camera frustum

interface FrustumProps {
  k: Intrinsics
  w: number
  h: number
  pose: Pose
  depth?: number
  color?: string
  /** scene points to project: draws rays + dots on the image plane */
  points?: { p: V3; color: string }[]
  rays?: boolean
  label?: string
  body?: boolean
}

/**
 * Visualizes a pinhole camera in 3D: optical center, image plane at `depth`
 * (sized by the actual intrinsics!), frustum edges and optional projection rays.
 */
export function CameraFrustumViz({
  k,
  w,
  h,
  pose,
  depth = 0.6,
  color = '#22d3ee',
  points = [],
  rays = true,
  label,
  body = true,
}: FrustumProps) {
  const C = cameraCenter(pose)
  const corners = useMemo(
    () =>
      [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ].map(([u, v]) => pixelToWorld(k, pose, u, v, depth)),
    [k, pose, w, h, depth],
  )
  const bodyQuat = useMemo(() => {
    const R = m3T(pose.R) // camera→world
    const m = new THREE.Matrix4().set(
      R[0], R[1], R[2], 0,
      R[3], R[4], R[5], 0,
      R[6], R[7], R[8], 0,
      0, 0, 0, 1,
    )
    return new THREE.Quaternion().setFromRotationMatrix(m)
  }, [pose])

  const zAxisWorld: V3 = m3T(pose.R).slice(6) as V3 // 3rd row of R = camera z in world
  const bodyPos = add(C, scale([zAxisWorld[0], zAxisWorld[1], zAxisWorld[2]], -0.05))

  return (
    <group>
      {body && (
        <mesh position={bodyPos} quaternion={bodyQuat}>
          <boxGeometry args={[0.11, 0.08, 0.1]} />
          <meshStandardMaterial color="#28334a" metalness={0.4} roughness={0.35} />
        </mesh>
      )}
      <mesh position={C}>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {corners.map((c, i) => (
        <Polyline key={i} points={[C, c]} color={color} lineWidth={1.2} opacity={0.8} />
      ))}
      <Polyline
        points={[...corners, corners[0]]}
        color={color}
        lineWidth={2}
      />
      <Quad corners={corners} color={color} opacity={0.07} />
      {points.map((sp, i) => {
        const proj = projectPoint(k, pose, sp.p)
        const visible = proj.z > 0 && proj.u >= 0 && proj.u <= w && proj.v >= 0 && proj.v <= h
        if (!visible) return null
        const onPlane = pixelToWorld(k, pose, proj.u, proj.v, depth)
        return (
          <group key={i}>
            {rays && <Polyline points={[C, sp.p]} color={sp.color} lineWidth={1} opacity={0.55} />}
            <mesh position={onPlane}>
              <sphereGeometry args={[0.016, 12, 12]} />
              <meshBasicMaterial color={sp.color} />
            </mesh>
          </group>
        )
      })}
      {label && (
        <Html position={[C[0], C[1] + 0.14, C[2]]} center zIndexRange={[60, 0]}>
          <div className="frame-label" style={{ color, borderColor: color }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---------------------------------------------------------------- checkerboard

/** Physical checkerboard: `cols`×`rows` squares in the board's local x/y plane, z pointing out. */
export function Checkerboard3D({
  pose,
  cols = 8,
  rows = 6,
  square = 0.05,
}: {
  pose: M4
  cols?: number
  rows?: number
  square?: number
}) {
  const matrix = useMemo(() => {
    const m = new THREE.Matrix4()
    m.set(
      pose[0], pose[1], pose[2], pose[3],
      pose[4], pose[5], pose[6], pose[7],
      pose[8], pose[9], pose[10], pose[11],
      pose[12], pose[13], pose[14], pose[15],
    )
    return m
  }, [pose])

  const squares = useMemo(() => {
    const list: { x: number; y: number; dark: boolean }[] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        list.push({
          x: (c - (cols - 1) / 2) * square,
          y: (r - (rows - 1) / 2) * square,
          dark: (r + c) % 2 === 0,
        })
    return list
  }, [cols, rows, square])

  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      <mesh position={[0, 0, -0.002]}>
        <boxGeometry args={[(cols + 1.2) * square, (rows + 1.2) * square, 0.004]} />
        <meshStandardMaterial color="#d9dee8" roughness={0.8} />
      </mesh>
      {squares.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, 0.0005]}>
          <planeGeometry args={[square, square]} />
          <meshStandardMaterial color={s.dark ? '#11151f' : '#e8ecf4'} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}
