import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components';

interface RosterSummaryEmailProps {
  weekStartDate: string;
  staffName: string;
  shifts: Array<{
    day: string;
    date: string;
    startTime: string;
    endTime: string;
    role?: string;
    isBackupBarista?: boolean;
    notes?: string;
  }>;
  totalHours: number;
}

export default function RosterSummaryEmail({
  weekStartDate,
  staffName,
  shifts,
  totalHours,
}: RosterSummaryEmailProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <Html>
      <Head />
      <Preview>Your Wild Octave roster for week of {formatDate(weekStartDate)}</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', margin: '0 auto', padding: '20px 0 48px', marginBottom: '64px' }}>
          <Section style={{ padding: '0 48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
              <div style={{ width: '32px', height: '32px', backgroundColor: '#7c3aed', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>
                <span style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>★</span>
              </div>
              <Heading style={{ color: '#1f2937', fontSize: '24px', fontWeight: 'bold', margin: '0' }}>
                Wild Octave
              </Heading>
            </div>

            <Heading style={{ color: '#1f2937', fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
              Hi {staffName}! 👋
            </Heading>

            <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px', marginBottom: '24px' }}>
              Your roster for the week of <strong>{formatDate(weekStartDate)}</strong> is ready! 
              You have <strong>{shifts.length} shift{shifts.length !== 1 ? 's' : ''}</strong> scheduled 
              for a total of <strong>{totalHours.toFixed(1)} hours</strong>.
            </Text>

            {shifts.length > 0 ? (
              <Section style={{ marginBottom: '32px' }}>
                <Heading style={{ color: '#1f2937', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                  Your Shifts
                </Heading>
                
                {shifts.map((shift, index) => (
                  <div key={index} style={{ 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px', 
                    padding: '16px', 
                    marginBottom: '12px',
                    backgroundColor: shift.isBackupBarista ? '#fef3c7' : '#f9fafb'
                  }}>
                    <Row>
                      <Column style={{ width: '25%' }}>
                        <Text style={{ color: '#1f2937', fontSize: '14px', fontWeight: '600', margin: '0' }}>
                          {shift.day}
                        </Text>
                        <Text style={{ color: '#6b7280', fontSize: '12px', margin: '0' }}>
                          {shift.date}
                        </Text>
                      </Column>
                      <Column style={{ width: '25%' }}>
                        <Text style={{ color: '#1f2937', fontSize: '14px', fontWeight: '600', margin: '0' }}>
                          {shift.startTime} - {shift.endTime}
                        </Text>
                      </Column>
                      <Column style={{ width: '25%' }}>
                        {shift.role && (
                          <Text style={{ color: '#374151', fontSize: '12px', margin: '0', textTransform: 'capitalize' }}>
                            {shift.role}
                          </Text>
                        )}
                        {shift.isBackupBarista && (
                          <Text style={{ color: '#d97706', fontSize: '12px', margin: '0', fontWeight: '600' }}>
                            Backup Barista
                          </Text>
                        )}
                      </Column>
                      <Column style={{ width: '25%' }}>
                        {shift.notes && (
                          <Text style={{ color: '#6b7280', fontSize: '12px', margin: '0' }}>
                            {shift.notes}
                          </Text>
                        )}
                      </Column>
                    </Row>
                  </div>
                ))}
              </Section>
            ) : (
              <Section style={{ 
                backgroundColor: '#fef3c7', 
                border: '1px solid #f59e0b', 
                borderRadius: '8px', 
                padding: '16px', 
                marginBottom: '32px' 
              }}>
                <Text style={{ color: '#92400e', fontSize: '14px', margin: '0' }}>
                  You don't have any shifts scheduled for this week. If you believe this is an error, 
                  please contact your manager.
                </Text>
              </Section>
            )}

            <Section style={{ 
              backgroundColor: '#f3f4f6', 
              border: '1px solid #d1d5db', 
              borderRadius: '8px', 
              padding: '16px', 
              marginBottom: '24px' 
            }}>
              <Text style={{ color: '#374151', fontSize: '14px', margin: '0 0 8px 0', fontWeight: '600' }}>
                Important Reminders:
              </Text>
              <ul style={{ color: '#6b7280', fontSize: '13px', paddingLeft: '16px', margin: '0' }}>
                <li>Please arrive 10 minutes before your shift starts</li>
                <li>Wear your Wild Octave uniform and name tag</li>
                <li>If you can't make your shift, find a replacement and notify management ASAP</li>
                <li>Check the café WhatsApp group for any last-minute updates</li>
              </ul>
            </Section>

            <Text style={{ color: '#6b7280', fontSize: '13px', lineHeight: '20px' }}>
              Questions about your roster? Reply to this email or contact your manager.<br />
              <br />
              Thanks for being part of the Wild Octave team! ☕
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}