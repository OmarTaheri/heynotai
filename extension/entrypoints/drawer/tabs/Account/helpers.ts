export function planLabel(p: 'check' | 'verify' | 'certify' | 'team'): string {
  switch (p) {
    case 'check': return 'Check · Free';
    case 'verify': return 'Verify · $10/mo';
    case 'certify': return 'Certify · $30/mo';
    case 'team': return 'Team · Multi-seat';
  }
}
