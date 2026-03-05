import React from 'react'

import type { AwesomeListElement } from 'shared/types/list'

import { useFilter } from '@/contexts/filter'
import { useList } from '@/contexts/list'
import { useMarkers } from '@/contexts/markers'

import { GroupedResourceGrid } from '@/components/modules/resource/grouped-grid'

export interface FilterOptions {
  search: string
  selectedTags: Array<string>
  tagsFilterOperator: 'and' | 'or' | 'not'
}

export const filterElements = (
  elements: Array<AwesomeListElement>,
  options: FilterOptions,
): Array<AwesomeListElement> => {
  let filtered = elements

  if (options.selectedTags.length > 0) {
    filtered = filtered.filter((element) =>
      options.tagsFilterOperator === 'and'
        ? options.selectedTags.every((tag) => element.tags.includes(tag))
        : options.tagsFilterOperator === 'or'
          ? options.selectedTags.some((tag) => element.tags.includes(tag))
          : !options.selectedTags.some((tag) => element.tags.includes(tag)),
    )
  }

  if (options.search.trim() !== '') {
    const searchWords = options.search
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 0)

    filtered = filtered.filter((element) => {
      const searchable = [
        element.name.toLowerCase(),
        element.description.toLowerCase(),
        ...element.tags.map((tag) => tag.toLowerCase()),
      ]

      return searchWords.every((word) =>
        searchable.some((field) => field.includes(word)),
      )
    })
  }

  return filtered
}

export interface ResourceGridProps {}

export const ResourceGrid: React.FC<ResourceGridProps> = () => {
  const { search, selectedTags, tagsFilterOperator } = useFilter()
  const list = useList()
  const { getElementBehavior } = useMarkers()

  const filteredElements = React.useMemo(() => {
    return filterElements(list.content.new.elements, {
      search,
      selectedTags,
      tagsFilterOperator,
    })
  }, [
    search,
    list.content.new.elements,
    selectedTags,
    tagsFilterOperator,
    getElementBehavior,
  ])

  return <GroupedResourceGrid filteredElements={filteredElements} />
}
