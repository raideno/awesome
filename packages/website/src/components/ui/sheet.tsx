import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { Cross1Icon } from '@radix-ui/react-icons'
import { IconButton } from '@radix-ui/themes'

import { cn } from 'shared/lib/utils'

function SheetRoot({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return (
    <DialogPrimitive.Portal
      container={document.body}
      data-slot="sheet-portal"
      {...props}
    />
  )
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  portal = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left'
  portal?: boolean
}) {
  const PortalComponent = portal ? SheetPortal : React.Fragment

  return (
    <>
      <PortalComponent>
        <SheetOverlay />
        <DialogPrimitive.Content
          data-slot="sheet-content"
          className={cn(
            'bg-[var(--color-panel)] data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
            side === 'right' &&
              'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
            side === 'left' &&
              'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
            side === 'top' &&
              'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
            side === 'bottom' &&
              'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close asChild className="absolute top-4 right-4">
            <IconButton size={'3'} variant="ghost">
              <div>
                <Cross1Icon width={'12'} height={'12'} />
                <span className="sr-only">Close</span>
              </div>
            </IconButton>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </PortalComponent>
    </>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-body"
      className={cn('flex-1 p-4', className)}
      {...props}
    />
  )
}

const Sheet = Object.assign(SheetRoot, {
  Root: SheetRoot,
  Trigger: SheetTrigger,
  Close: SheetClose,
  Portal: SheetPortal,
  Overlay: SheetOverlay,
  Content: SheetContent,
  Header: SheetHeader,
  Body: SheetBody,
  Footer: SheetFooter,
  Title: SheetTitle,
  Description: SheetDescription,
})

export { Sheet }
