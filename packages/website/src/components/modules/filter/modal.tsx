import React from 'react'

import { Cross1Icon, MagnifyingGlassIcon } from '@radix-ui/react-icons'
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
import { ToggleGroup } from 'shared/components/ui/toggle-group'

import type { TagsFilterOperator } from '@/contexts/filter'

import { useFilter } from '@/contexts/filter'
import { useList } from '@/contexts/list'

export interface FilterModalProps {
  children: React.ReactNode
}

export const TagFilterModal: React.FC<FilterModalProps> = ({
  children: trigger,
}) => {
  const {
    tagsFilterOperator,
    setTagsFilterOperator,
    selectedTags,
    addTag,
    removeTag,
    clearTags,
  } = useFilter()

  const [search, setSearch] = React.useState<string>('')

  const { tags: allTags } = useList()

  const modalFilteredTags = allTags.filter((tag) =>
    tag.toLowerCase().includes(search.toLowerCase()),
  )

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
      <Dialog.Content className="!w-full" aria-label="Select tags to filter">
        <style>
          {`
          .rt-BaseDialogScrollPadding {
            padding: 0 !important;
          }
          `}
        </style>
        <Flex className="w-full" direction={'column'} gap={'4'}>
          <Box>
            <>
              <Dialog.Title className="sr-only">Select Tags</Dialog.Title>
              <Dialog.Description className="sr-only">
                Select tags to filter the resources. You can use "Or" to match
                any tag, "&" to match all selected tags, or "Not" to exclude
                resources with any of the selected tags.
              </Dialog.Description>
            </>
            <Heading size={'4'} slot="title" className="text-lg font-bold">
              Select Tags
            </Heading>
            <Text>
              Select tags to filter the resources. You can use "Or" to match any
              tag, "&" to match all selected tags, or "Not" to exclude resources
              with any of the selected tags.
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
              <ToggleGroup.Root
                type="single"
                defaultValue="and"
                value={tagsFilterOperator}
                onValueChange={(value) =>
                  value && setTagsFilterOperator(value as TagsFilterOperator)
                }
              >
                <ToggleGroup.Item
                  className="group data-[state=on]:font-bold"
                  value="or"
                >
                  <Text>Or</Text>
                </ToggleGroup.Item>
                <ToggleGroup.Item
                  className="group data-[state=on]:font-bold"
                  value="and"
                >
                  <Text>&</Text>
                </ToggleGroup.Item>
                <ToggleGroup.Item
                  className="group data-[state=on]:font-bold"
                  value="not"
                >
                  <Text>Not</Text>
                </ToggleGroup.Item>
              </ToggleGroup.Root>
            </Flex>
          </Flex>

          <Card className="!p-0">
            <ScrollArea scrollbars="vertical">
              <Flex className="max-h-60 flex flex-col gap-1">
                {modalFilteredTags.length === 0 && (
                  <Box p={'6'} className="text-center">
                    <Text as="p" color="gray">
                      No tags found
                    </Text>
                  </Box>
                )}
                {modalFilteredTags.map((tag) => (
                  <Box
                    key={tag}
                    py={'2'}
                    px={'4'}
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        removeTag(tag)
                      } else {
                        addTag(tag)
                      }
                    }}
                    className="w-full cursor-pointer hover:bg-[var(--accent-5)]"
                  >
                    <Flex
                      direction={'row'}
                      align={'center'}
                      justify={'between'}
                    >
                      <Text as="div" color="gray">
                        {tag}
                      </Text>
                      {selectedTags.includes(tag) && (
                        <Text
                          size={'1'}
                          color="blue"
                          className="ml-auto underline"
                        >
                          Selected
                        </Text>
                      )}
                    </Flex>
                  </Box>
                ))}
              </Flex>
            </ScrollArea>
          </Card>
          {selectedTags.length > 0 && (
            <Button
              variant="outline"
              onClick={() => clearTags()}
              className="!w-full"
            >
              Clear All Tags
            </Button>
          )}
          <Dialog.Close>
            <Button variant="classic" className="!w-full">
              Close
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
