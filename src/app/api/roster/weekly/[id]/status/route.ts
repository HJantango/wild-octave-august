import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !['draft', 'published', 'archived'].includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid status. Must be draft, published, or archived' 
        },
        { status: 400 }
      );
    }

    // Update roster status
    const updatedRoster = await prisma.roster.update({
      where: {
        id: params.id
      },
      data: {
        status: status
      },
      include: {
        shifts: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                baseHourlyRate: true,
                isActive: true
              }
            }
          }
        }
      }
    });

    let emailResults = null;

    // If status is being set to 'published', automatically send emails
    if (status === 'published') {
      try {
        const emailResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/roster/weekly/${params.id}/send-emails`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (emailResponse.ok) {
          emailResults = await emailResponse.json();
        } else {
          console.error('Failed to send emails automatically');
        }
      } catch (error) {
        console.error('Error sending emails automatically:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedRoster,
      emailResults: emailResults
    });

  } catch (error) {
    console.error('Error updating roster status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update roster status' 
      },
      { status: 500 }
    );
  }
}