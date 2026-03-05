import { useEffect } from "react";

import { METADATA_ELEMENT_IDS } from "../constants";

import type { AwesomeList } from "../types/list";

function updateMetaContent(id: string, newContent: string) {
  const element = document.getElementById(id) as HTMLMetaElement | null;
  if (element && element.content !== newContent) {
    element.content = newContent;
  }
}

export function useDynamicMetadata(list: AwesomeList) {
  useEffect(() => {
    const { title, description, thumbnail, author } = list;

    const titleElement = document.getElementById(
      METADATA_ELEMENT_IDS.PAGE_TITLE,
    );
    if (titleElement && titleElement.textContent !== title) {
      titleElement.textContent = title;
      if (!document.title.startsWith("* ")) {
        document.title = title;
      }
    }

    updateMetaContent(METADATA_ELEMENT_IDS.PAGE_DESCRIPTION, description);
    updateMetaContent(METADATA_ELEMENT_IDS.OG_TITLE, title);
    updateMetaContent(METADATA_ELEMENT_IDS.OG_DESCRIPTION, description);
    updateMetaContent(METADATA_ELEMENT_IDS.TWITTER_TITLE, title);
    updateMetaContent(METADATA_ELEMENT_IDS.TWITTER_DESCRIPTION, description);

    if (author) {
      updateMetaContent(METADATA_ELEMENT_IDS.AUTHOR, author);
      updateMetaContent(METADATA_ELEMENT_IDS.ARTICLE_AUTHOR, author);
    }

    if (thumbnail) {
      updateMetaContent(METADATA_ELEMENT_IDS.OG_IMAGE, thumbnail);
      updateMetaContent(METADATA_ELEMENT_IDS.TWITTER_IMAGE, thumbnail);
    }
  }, [list]);
}
