import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ImageBackground,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load announcements.';

const getImageUrl = (relativeUrl) => {
  if (!relativeUrl) {
    return null;
  }

  if (relativeUrl.startsWith('http')) {
    return relativeUrl;
  }

  return `${client.defaults.baseURL.replace(/\/api$/, '')}${relativeUrl}`;
};

const getAudienceForRole = (role) => {
  if (role === 'Patient') {
    return 'Patients';
  }

  if (role === 'Doctor') {
    return 'Doctors';
  }

  if (['Receptionist', 'Accountant', 'Pharmacist'].includes(role)) {
    return 'Staff';
  }

  return null;
};

const AnnouncementCarousel = () => {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [announcements, setAnnouncements] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  const targetAudience = useMemo(() => getAudienceForRole(user?.role), [user?.role]);
  const bannerWidth = Math.max(280, width - 32);

  useEffect(() => {
    let isMounted = true;

    const fetchAnnouncements = async () => {
      try {
        const response = await client.get('/announcements', {
          params: targetAudience ? { targetAudience } : undefined,
        });
        const activeAnnouncements = response.data.announcements || [];

        if (isMounted) {
          setAnnouncements(activeAnnouncements);
          setIsVisible(activeAnnouncements.length > 0);
        }
      } catch (error) {
        console.warn(getErrorMessage(error));

        if (isMounted) {
          setAnnouncements([]);
          setIsVisible(false);
        }
      }
    };

    fetchAnnouncements();

    return () => {
      isMounted = false;
    };
  }, [targetAudience]);

  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <FlatList
        data={announcements}
        horizontal
        keyExtractor={(item) => item._id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={bannerWidth + 12}
        decelerationRate="fast"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const imageUrl = getImageUrl(item.imageUrl);
          const content = (
            <View style={styles.overlay}>
              <View style={styles.copyBox}>
                <Text style={styles.audience}>{item.targetAudience}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description} numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
            </View>
          );

          if (!imageUrl) {
            return <View style={[styles.banner, { width: bannerWidth }]}>{content}</View>;
          }

          return (
            <ImageBackground
              source={{ uri: imageUrl }}
              style={[styles.banner, { width: bannerWidth }]}
              imageStyle={styles.bannerImage}
              resizeMode="cover"
            >
              {content}
            </ImageBackground>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  list: {
    gap: 12,
  },
  banner: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.primary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bannerImage: {
    borderRadius: 8,
  },
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.46)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  copyBox: {
    maxWidth: '92%',
  },
  audience: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  description: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
});

export default AnnouncementCarousel;
