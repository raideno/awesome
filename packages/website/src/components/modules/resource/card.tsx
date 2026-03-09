import React from 'react'

import { Badge, Box, Card, Flex, Heading, Link, Text } from '@radix-ui/themes'
import { cn } from 'shared/lib/utils'

import { ResourceCardDialog } from './card-dialog'

import type { CardProps } from '@radix-ui/themes'
import type { AwesomeListElement } from 'shared/types/list'

import { useMarkers } from '@/contexts/markers'

export interface ResourceCardProps extends CardProps {
  element: AwesomeListElement
  groupColor?: string
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  element,
  groupColor,
  className,
  role = 'region',
  tabIndex = 0,
  'aria-label': ariaLabel = element.name,
  ...props
}) => {
  const { getElementBehavior } = useMarkers()
  const behavior = getElementBehavior(element.tags)

  const isCrossed = behavior === 'cross'
  const isHighlighted = behavior === 'highlight'

  if (behavior === 'hide') return null

  return (
    <ResourceCardDialog element={element}>
      <Card
        className={cn(
          'group h-full transition-all cursor-pointer',
          isCrossed && 'opacity-60',
          className,
        )}
        {...props}
      >
        <Flex
          className="h-full"
          direction={'column'}
          justify={'between'}
          gap={'3'}
        >
          <Flex direction={'column'} gap={'2'}>
            <Heading
              size={'5'}
              weight={'bold'}
              className={cn(
                'line-clamp-1',
                'group-hover:text-test-100',
                isCrossed && 'line-through',
              )}
              style={
                isHighlighted && groupColor ? { color: groupColor } : undefined
              }
            >
              {element.name}
            </Heading>
            <Text
              className={cn(
                'leading-relaxed flex-grow markdown-content',
                isCrossed && 'line-through',
              )}
            >
              {element.description}
            </Text>
            <div className="flex flex-wrap gap-2">
              {element.tags.slice(0, 4).map((tag) => (
                <Badge size={'1'} key={tag} tabIndex={0} role="button">
                  {tag}
                </Badge>
              ))}
              {element.tags.length > 4 && (
                <Badge>+{element.tags.length - 4} more</Badge>
              )}
            </div>
          </Flex>
          <Box>
            {element.link && (
              <Link
                href={element.link}
                className="!underline truncate block"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {element.link.length > 32
                  ? element.link.slice(0, 32) + '...'
                  : element.link}
              </Link>
            )}
          </Box>
        </Flex>
      </Card>
    </ResourceCardDialog>
  )
}
