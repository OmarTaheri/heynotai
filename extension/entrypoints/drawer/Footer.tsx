import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { get } from '@/lib/storage';

export function Footer() {
  const [count, setCount] = useState(128);

  useEffect(() => {
    get('scanHistory').then(h => { if (h) setCount(h.length); });
  }, []);

  return (
    <footer className="pop-footer">
      <span>last scan · 00:01.4s ago</span>
      <span className="usage">
        <Icon name="bolt" size={10} />
        <span>{count}</span> / 25,000 scans
      </span>
    </footer>
  );
}
