'use client'

import type React from 'react'
import { useEffect, useState } from 'react'

type Props = {
  children: React.ReactNode
  contentClassName?: string
}

type ParticleStyle = React.CSSProperties & {
  '--duration'?: string
  '--delay'?: string
}

type Particle = {
  id: number
  style: ParticleStyle
}

export default function AmbientBackground({ children, contentClassName }: Props) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const width = window.innerWidth
    const count = width >= 1920 ? 26 : width >= 1280 ? 20 : width >= 768 ? 14 : 10

    const created: Particle[] = Array.from({ length: count }).map((_, idx) => {
      const top = Math.random() * 100
      const left = Math.random() * 100
      const duration = 45 + Math.random() * 30
      const delay = -Math.random() * 60
      const style: ParticleStyle = {
        top: `${top}%`,
        left: `${left}%`,
        '--duration': `${duration}s`,
        '--delay': `${delay}s`,
      }
      return { id: idx, style }
    })
    const frame = requestAnimationFrame(() => setParticles(created))

    return () => cancelAnimationFrame(frame)
  }, [])

  const contentClass = contentClassName
    ? `bf-ambient-content relative z-10 ${contentClassName}`
    : 'bf-ambient-content relative z-10'

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 bf-ambient-bg" aria-hidden>
        <div className="bf-orb bf-orb-1" />
        <div className="bf-orb bf-orb-2" />
        <div className="bf-orb bf-orb-3" />
        <div className="bf-noise" />
        <div className="bf-particles">
          {particles.map((particle) => (
            <span key={particle.id} className="bf-particle" style={particle.style} />
          ))}
        </div>
      </div>
      <div className={contentClass}>{children}</div>
    </div>
  )
}

