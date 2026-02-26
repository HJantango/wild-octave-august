import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { confirm, action = "list", staffIds = [] } = body;

    if (action === "list") {
      // Just list potential cleanup candidates
      const testDataPatterns = [
        /test/i,
        /debug/i,
        /example/i,
        /temp/i,
        /demo/i,
        /paige/i
      ];

      const allStaff = await prisma.rosterStaff.findMany({
        select: {
          id: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true
        }
      });

      const candidates = allStaff.filter(staff => 
        testDataPatterns.some(pattern => pattern.test(staff.name))
      );

      return NextResponse.json({
        success: true,
        action: "list",
        candidates,
        instructions: {
          message: "To delete specific staff, send:",
          example: {
            action: "delete",
            confirm: "DELETE_TEST_DATA",
            staffIds: ["id1", "id2"]
          }
        }
      });
    }

    if (action === "delete") {
      if (confirm !== "DELETE_TEST_DATA") {
        return NextResponse.json({
          success: false,
          error: "Must include confirm: 'DELETE_TEST_DATA' to proceed"
        });
      }

      if (!Array.isArray(staffIds) || staffIds.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Must provide staffIds array"
        });
      }

      // Safety check - get names first
      const toDelete = await prisma.rosterStaff.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, name: true }
      });

      // Delete the staff records
      const deleteResult = await prisma.rosterStaff.deleteMany({
        where: { id: { in: staffIds } }
      });

      return NextResponse.json({
        success: true,
        action: "delete",
        deleted: deleteResult.count,
        deletedStaff: toDelete
      });
    }

    return NextResponse.json({
      success: false,
      error: "Invalid action. Use 'list' or 'delete'"
    });

  } catch (error) {
    console.error('Error in cleanup:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}