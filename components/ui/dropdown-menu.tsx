'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const DropdownMenuContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
} | null>(null)

function useDropdownMenuContext() {
  const context = React.useContext(DropdownMenuContext)
  if (!context) {
    throw new Error('DropdownMenu components must be used within a DropdownMenu')
  }
  return context
}

interface DropdownMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function DropdownMenu({ open, onOpenChange, children }: DropdownMenuProps) {
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen: onOpenChange }}>
      <div className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  )
}

interface DropdownMenuTriggerProps {
  asChild?: boolean
  children: React.ReactNode
}

export function DropdownMenuTrigger({ asChild, children }: DropdownMenuTriggerProps) {
  const { setOpen, open } = useDropdownMenuContext()

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => setOpen(!open),
    })
  }

  return (
    <button type="button" onClick={() => setOpen(!open)}>
      {children}
    </button>
  )
}

interface DropdownMenuContentProps {
  align?: 'start' | 'end'
  children: React.ReactNode
  className?: string
}

export function DropdownMenuContent({ align = 'end', children, className }: DropdownMenuContentProps) {
  const { open, setOpen } = useDropdownMenuContext()
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, setOpen])

  if (!open) return null

  return (
    <div
      ref={ref}
      className={cn(
        'absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 shadow-lg',
        'dark:bg-slate-800 dark:border-slate-700',
        align === 'end' ? 'right-0' : 'left-0',
        className
      )}
    >
      {children}
    </div>
  )
}

interface DropdownMenuItemProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  asChild?: boolean
}

export function DropdownMenuItem({
  children,
  className,
  onClick,
  asChild,
}: DropdownMenuItemProps) {
  const { setOpen } = useDropdownMenuContext()

  const handleClick = () => {
    onClick?.()
    setOpen(false)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: handleClick,
    })
  }

  return (
    <div
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'hover:bg-slate-100 dark:hover:bg-slate-700',
        'focus:bg-slate-100 dark:focus:bg-slate-700',
        className
      )}
      onClick={handleClick}
    >
      {children}
    </div>
  )
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
}
