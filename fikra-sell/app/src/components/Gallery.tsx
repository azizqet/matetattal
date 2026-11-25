import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StatusBar, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { publicUrl } from '../lib/supabase';
import type { AdImage } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';
import { BulbMark } from './Brand';
import { Icon } from './Icon';

export function Gallery({ images, height }: { images: AdImage[]; height: number }) {
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const viewerRef = useRef<FlatList<AdImage>>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width));

  if (!images.length) {
    return <View style={{ height, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><BulbMark size={56} lit={false} color={c.lineStrong} /></View>;
  }
  return (
    <View>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        keyExtractor={(i) => String(i.id)}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item, index: i }) => (
          <Pressable onPress={() => setViewer(i)} accessibilityRole="imagebutton" accessibilityLabel={`${i + 1} / ${images.length}`}>
            <Image source={{ uri: publicUrl('ad-images', item.path) }} style={{ width, height, backgroundColor: c.surface }} contentFit="cover" transition={200} cachePolicy="memory-disk" priority={i === 0 ? 'high' : 'normal'} />
          </Pressable>
        )}
      />
      {images.length > 1 && (
        <View style={{ position: 'absolute', bottom: 28, alignSelf: 'center', flexDirection: 'row', gap: 5 }}>
          {images.slice(0, 15).map((_, i) => <View key={i} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? c.accent : 'rgba(255,255,255,0.75)' }} />)}
        </View>
      )}
      <View style={{ position: 'absolute', bottom: 22, end: space.lg, backgroundColor: 'rgba(14,15,19,0.6)', borderRadius: radius.socket, paddingHorizontal: 8, paddingVertical: 4 }}>
        <Text style={{ color: '#FFF', fontFamily: font.medium, fontSize: 12 }}>{t('ad.photos', { n: `${index + 1}/${images.length}` })}</Text>
      </View>

      <Modal visible={viewer !== null} animationType="fade" onRequestClose={() => setViewer(null)} statusBarTranslucent>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <FlatList
            ref={viewerRef}
            data={images}
            horizontal
            pagingEnabled
            initialScrollIndex={viewer ?? 0}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(i) => `v${i.id}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => <Image source={{ uri: publicUrl('ad-images', item.path) }} style={{ width, height: '100%' }} contentFit="contain" />}
          />
          <Pressable onPress={() => setViewer(null)} accessibilityRole="button" accessibilityLabel={t('common.close')}
            style={{ position: 'absolute', top: insets.top + 10, end: space.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" color="#FFF" spark={false} />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
