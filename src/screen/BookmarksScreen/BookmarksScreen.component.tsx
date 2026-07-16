import { FilmPager } from 'Component/FilmPager';
import { InfoBlock } from 'Component/InfoBlock';
import { LocalCategoriesOverlay } from 'Component/LocalCategoriesOverlay';
import { Page } from 'Component/Page';
import { ThemedButton } from 'Component/ThemedButton';
import { t } from 'i18n/translate';
import { FolderCog } from 'lucide-react-native';
import { View } from 'react-native';

import { styles } from './BookmarksScreen.style';
import { BookmarksScreenThumbnail } from './BookmarksScreen.thumbnail';
import { BookmarksScreenComponentProps } from './BookmarksScreen.type';

export function BookmarksScreenComponent({
  isLoading,
  pagerItems,
  isLocalLibrary,
  manageCategoriesOverlayRef,
  onLoadFilms,
  onUpdateFilms,
  openManageCategories,
}: BookmarksScreenComponentProps) {
  const renderManageButton = () => (
    <ThemedButton
      variant="outlined"
      IconComponent={ FolderCog }
      onPress={ openManageCategories }
    >
      { t('Manage categories') }
    </ThemedButton>
  );

  const renderContent = () => {
    if (isLoading) {
      return <BookmarksScreenThumbnail />;
    }

    if (!pagerItems.length) {
      return (
        <View style={ styles.empty }>
          <InfoBlock
            title={ t('No bookmarks group') }
            subtitle={ isLocalLibrary
              ? t('Create a category to start bookmarking')
              : t('Go to site and create bookmarks group') }
          />
          { isLocalLibrary && renderManageButton() }
        </View>
      );
    }

    return (
      <View style={ styles.content }>
        { isLocalLibrary && (
          <View style={ styles.header }>
            { renderManageButton() }
          </View>
        ) }
        <FilmPager
          items={ pagerItems }
          onLoadFilms={ onLoadFilms }
          onUpdateFilms={ onUpdateFilms }
        />
      </View>
    );
  };

  return (
    <Page>
      { renderContent() }
      { isLocalLibrary && (
        <LocalCategoriesOverlay overlayRef={ manageCategoriesOverlayRef } />
      ) }
    </Page>
  );
}

export default BookmarksScreenComponent;
