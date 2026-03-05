import React from 'react'

import {
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  Text,
  TextField,
} from '@radix-ui/themes'
import {
  Cross1Icon,
  Cross2Icon,
  EyeClosedIcon,
  MagnifyingGlassIcon,
  RocketIcon,
} from '@radix-ui/react-icons'

import { ToggleGroup } from 'shared/components/ui/toggle-group'

import type { MarkerBehavior } from '@/contexts/markers'

import { useList } from '@/contexts/list'
import { useMarkers } from '@/contexts/markers'

export interface MarkersModalProps {
  children: React.ReactNode
}

const BehaviorIcon: React.FC<{ behavior: MarkerBehavior }> = ({ behavior }) => {
  switch (behavior) {
    case 'hide':
      return <EyeClosedIcon />
    case 'cross':
      return <Cross2Icon />
    case 'highlight':
      return <RocketIcon />
    default:
      return null
  }
}

export const MarkersModal: React.FC<MarkersModalProps> = ({
  children: trigger,
}) => {
  const { rules, addRule, removeRule, clearRules } = useMarkers()
  const [search, setSearch] = React.useState<string>('')

  const { tags: allTags } = useList()

  const modalFilteredTags = allTags.filter((tag) =>
    tag.toLowerCase().includes(search.toLowerCase()),
  )

  const getRuleBehavior = (tag: string): MarkerBehavior => {
    return rules.find((rule) => rule.tag === tag)?.behavior || 'none'
  }

  const handleBehaviorChange = (tag: string, behavior: string | undefined) => {
    if (!behavior || behavior === 'none') {
      removeRule(tag)
    } else {
      addRule(tag, behavior as MarkerBehavior)
    }
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <style>
        {`
          .rt-BaseDialogScrollPadding {
            padding: 0 !important;
          }
          `}
      </style>
      <Dialog.Content className="!w-full" aria-label="Configure markers">
        <Flex className="w-full" direction={'column'} gap={'4'}>
          <Box>
            <>
              <Dialog.Title className="sr-only">Configure Markers</Dialog.Title>
              <Dialog.Description className="sr-only">
                Assign behaviors to tags to automatically mark resources. Hidden
                items won't appear in the list, crossed items will show with a
                strikethrough, and highlighted items will stand out.
              </Dialog.Description>
            </>
            <Heading size={'4'} slot="title" className="text-lg font-bold">
              Configure Markers
            </Heading>
            <Text>
              Assign behaviors to tags to automatically mark resources. Hidden
              items won't appear in the list, crossed items will show with a
              strikethrough, and highlighted items will stand out.
            </Text>
          </Box>
          <Flex direction={'column'} gap={'2'}>
            <Flex direction={'row'} gap={'2'} align={'center'}>
              <TextField.Root
                className="w-full"
                placeholder="Search tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              >
                <TextField.Slot side="left">
                  <MagnifyingGlassIcon height="16" width="16" />
                </TextField.Slot>
                {search && (
                  <TextField.Slot side="right">
                    <IconButton variant="ghost" onClick={() => setSearch('')}>
                      <Cross1Icon />
                    </IconButton>
                  </TextField.Slot>
                )}
              </TextField.Root>
            </Flex>
            <ScrollArea
              style={{ height: 'min(50vh, 400px)' }}
              className="w-full"
              scrollbars="vertical"
            >
              <Flex direction={'column'} gap={'2'} pr={'3'}>
                {modalFilteredTags.length > 0 ? (
                  modalFilteredTags.map((tag) => {
                    const currentBehavior = getRuleBehavior(tag)
                    return (
                      <Card key={tag}>
                        <Flex
                          direction={'row'}
                          justify={'between'}
                          align={'center'}
                          gap={'2'}
                        >
                          <Text weight={'medium'}>{tag}</Text>
                          <ToggleGroup.Root
                            type="single"
                            value={currentBehavior}
                            onValueChange={(value) =>
                              handleBehaviorChange(tag, value)
                            }
                          >
                            <ToggleGroup.Item
                              value="hide"
                              aria-label="Hide items with this tag"
                            >
                              <BehaviorIcon behavior="hide" />
                            </ToggleGroup.Item>
                            <ToggleGroup.Item
                              value="cross"
                              aria-label="Cross out items with this tag"
                            >
                              <BehaviorIcon behavior="cross" />
                            </ToggleGroup.Item>
                            <ToggleGroup.Item
                              value="highlight"
                              aria-label="Highlight items with this tag"
                            >
                              <BehaviorIcon behavior="highlight" />
                            </ToggleGroup.Item>
                          </ToggleGroup.Root>
                        </Flex>
                      </Card>
                    )
                  })
                ) : (
                  <Box className="mx-auto" py={'8'}>
                    <Text color="gray">No tags found.</Text>
                  </Box>
                )}
              </Flex>
            </ScrollArea>
          </Flex>
          <Flex direction={'row'} gap={'2'} justify={'end'}>
            {rules.length > 0 && (
              <Button variant="outline" onClick={clearRules}>
                Clear All
              </Button>
            )}
            <Dialog.Close>
              <Button variant="classic">Done</Button>
            </Dialog.Close>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
