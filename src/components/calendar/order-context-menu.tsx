'use client';

import { useEffect, useRef } from 'react';
import { Edit, Trash2, Check, X, Copy } from 'lucide-react';

interface OrderContextMenuProps {
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
  onMarkPlaced?: () => void;
  onMarkDelivered?: () => void;
  onDuplicate?: () => void;
  onClose: () => void;
  orderStatus?: string;
}

export function OrderContextMenu({
  x,
  y,
  onEdit,
  onDelete,
  onMarkPlaced,
  onMarkDelivered,
  onDuplicate,
  onClose,
  orderStatus,
}: OrderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const MenuItem = ({
    icon: Icon,
    label,
    onClick,
    destructive = false,
  }: {
    icon: any;
    label: string;
    onClick: () => void;
    destructive?: boolean;
  }) => (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      className={`w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
        destructive ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]"
      style={{ top: y, left: x }}
    >
      <MenuItem icon={Edit} label="Edit Order" onClick={onEdit} />

      {onDuplicate && (
        <MenuItem icon={Copy} label="Duplicate Order" onClick={onDuplicate} />
      )}

      {onMarkPlaced && orderStatus !== 'placed' && orderStatus !== 'delivered' && (
        <>
          <div className="border-t border-gray-200 my-1" />
          <MenuItem icon={Check} label="Mark as Placed" onClick={onMarkPlaced} />
        </>
      )}

      {onMarkDelivered && orderStatus !== 'delivered' && (
        <MenuItem icon={Check} label="Mark as Delivered" onClick={onMarkDelivered} />
      )}

      <div className="border-t border-gray-200 my-1" />
      <MenuItem icon={Trash2} label="Delete Order" onClick={onDelete} destructive />
    </div>
  );
}
