import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email } = body

    // Validation
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Try to create new participant
    try {
      const entry = await prisma.entry.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
        },
      })

      return NextResponse.json(
        { success: true, id: entry.id },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    } catch (error: any) {
      // If email already exists (unique constraint)
      if (error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'This email is already registered' },
          { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      }
      throw error
    }
  } catch (error: any) {
    console.error('Error in /api/enter:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'An error occurred during registration',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

