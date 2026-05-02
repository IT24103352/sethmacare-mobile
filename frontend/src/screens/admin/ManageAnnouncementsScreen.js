import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import InputField from '../../components/InputField';
import colors from '../../theme/colors';

const targetAudienceOptions = ['All', 'Patients', 'Doctors', 'Staff'];
const statusOptions = ['Active', 'Expired'];

const emptyForm = {
  title: '',
  description: '',
  targetAudience: 'All',
  status: 'Active',
};

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to manage announcements.';

const getImageUrl = (relativeUrl) => {
  if (!relativeUrl) {
    return null;
  }

  if (relativeUrl.startsWith('http')) {
    return relativeUrl;
  }

  return `${client.defaults.baseURL.replace(/\/api$/, '')}${relativeUrl}`;
};

const getAssetFileName = (asset) => {
  if (asset.fileName) {
    return asset.fileName;
  }

  const extension = asset.mimeType?.split('/')[1] || asset.uri?.split('.').pop() || 'jpg';
  return `announcement-${Date.now()}.${extension}`;
};

const buildFormData = (form, imageAsset) => {
  const formData = new FormData();

  formData.append('title', form.title.trim());
  formData.append('description', form.description.trim());
  formData.append('targetAudience', form.targetAudience);
  formData.append('status', form.status);

  if (imageAsset) {
    formData.append('image', {
      uri: imageAsset.uri,
      name: getAssetFileName(imageAsset),
      type: imageAsset.mimeType || 'image/jpeg',
    });
  }

  return formData;
};

const OptionGroup = ({ label, options, value, onChange }) => (
  <View style={styles.optionSection}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.optionGrid}>
      {options.map((option) => {
        const isSelected = value === option;

        return (
          <TouchableOpacity
            key={option}
            activeOpacity={0.82}
            onPress={() => onChange(option)}
            style={[styles.optionButton, isSelected && styles.selectedOption]}
          >
            <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const StatusBadge = ({ value }) => (
  <Text style={[styles.badge, value === 'Active' ? styles.activeBadge : styles.expiredBadge]}>
    {value}
  </Text>
);

const ManageAnnouncementsScreen = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedImage, setSelectedImage] = useState(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchAnnouncements = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/announcements/admin');
      setAnnouncements(response.data.announcements || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAnnouncements();
    }, [fetchAnnouncements])
  );

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedImage(null);
    setEditingAnnouncement(null);
    setError('');
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      return 'Announcement title is required.';
    }

    if (!form.description.trim()) {
      return 'Announcement description is required.';
    }

    if (!editingAnnouncement && !selectedImage) {
      return 'Announcement image is required.';
    }

    return '';
  };

  const handlePickImage = async () => {
    setError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Gallery permission is required to upload an announcement image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (result.canceled) {
      return;
    }

    setSelectedImage(result.assets[0]);
  };

  const handleSubmit = async () => {
    setError('');
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = buildFormData(form, selectedImage);
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };

      if (editingAnnouncement) {
        await client.patch(`/announcements/${editingAnnouncement._id}`, formData, config);
        Alert.alert('Announcement Updated', 'Announcement details were saved successfully.');
      } else {
        await client.post('/announcements', formData, config);
        Alert.alert('Announcement Created', 'Announcement was published successfully.');
      }

      resetForm();
      await fetchAnnouncements(true);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setSelectedImage(null);
    setError('');
    setForm({
      title: announcement.title || '',
      description: announcement.description || '',
      targetAudience: announcement.targetAudience || 'All',
      status: announcement.status || 'Active',
    });
  };

  const handleDelete = (announcement) => {
    Alert.alert('Delete Announcement', `Delete "${announcement.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/announcements/${announcement._id}`);

            if (editingAnnouncement?._id === announcement._id) {
              resetForm();
            }

            await fetchAnnouncements(true);
            Alert.alert('Announcement Deleted', 'Announcement was removed successfully.');
          } catch (deleteError) {
            Alert.alert('Delete Failed', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  const previewImageUrl = selectedImage?.uri || getImageUrl(editingAnnouncement?.imageUrl);
  const submitTitle = editingAnnouncement ? 'Save Announcement' : 'Create Announcement';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchAnnouncements(true)} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Manage Announcements</Text>
          <Text style={styles.subtitle}>{announcements.length} announcement records</Text>
        </View>

        <ErrorMessage message={error} />

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
          </Text>

          <Text style={styles.inputLabel}>Title</Text>
          <InputField
            placeholder="Announcement title"
            value={form.title}
            onChangeText={(value) => updateField('title', value)}
            autoCapitalize="sentences"
          />

          <Text style={styles.inputLabel}>Description</Text>
          <InputField
            placeholder="Announcement description"
            value={form.description}
            onChangeText={(value) => updateField('description', value)}
            autoCapitalize="sentences"
            multiline
            inputStyle={styles.descriptionInput}
          />

          <OptionGroup
            label="Target Audience"
            options={targetAudienceOptions}
            value={form.targetAudience}
            onChange={(value) => updateField('targetAudience', value)}
          />

          <OptionGroup
            label="Status"
            options={statusOptions}
            value={form.status}
            onChange={(value) => updateField('status', value)}
          />

          <Text style={styles.inputLabel}>Banner Image</Text>
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handlePickImage}
            style={styles.imagePicker}
          >
            {previewImageUrl ? (
              <Image source={{ uri: previewImageUrl }} style={styles.previewImage} />
            ) : (
              <Text style={styles.imagePlaceholder}>Select Image</Text>
            )}
          </TouchableOpacity>

          <CustomButton
            title={submitTitle}
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.submitButton}
          />
          {editingAnnouncement ? (
            <CustomButton
              title="Cancel Edit"
              type="secondary"
              onPress={resetForm}
              disabled={isSubmitting}
              style={styles.secondaryAction}
            />
          ) : null}
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Announcements</Text>
        </View>

        {isLoading ? (
          <Text style={styles.emptyText}>Loading announcements...</Text>
        ) : announcements.length ? (
          announcements.map((announcement) => {
            const imageUrl = getImageUrl(announcement.imageUrl);

            return (
              <View key={announcement._id} style={styles.card}>
                {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.cardImage} /> : null}

                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleBox}>
                      <Text style={styles.cardTitle}>{announcement.title}</Text>
                      <Text style={styles.cardDescription}>{announcement.description}</Text>
                    </View>
                    <StatusBadge value={announcement.status} />
                  </View>

                  <Text style={styles.audienceText}>{announcement.targetAudience}</Text>

                  <View style={styles.cardActions}>
                    <CustomButton
                      title="Edit"
                      type="secondary"
                      onPress={() => handleEdit(announcement)}
                      style={styles.cardButton}
                      textStyle={styles.cardButtonText}
                    />
                    <CustomButton
                      title="Delete"
                      type="secondary"
                      onPress={() => handleDelete(announcement)}
                      style={styles.cardButton}
                      textStyle={styles.deleteButtonText}
                    />
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No announcements found.</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  formTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  descriptionInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  optionSection: {
    marginBottom: 14,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  selectedOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  selectedOptionText: {
    color: colors.white,
  },
  imagePicker: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  imagePlaceholder: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  submitButton: {
    marginTop: 14,
  },
  secondaryAction: {
    marginTop: 10,
  },
  listHeader: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardImage: {
    aspectRatio: 16 / 9,
    width: '100%',
  },
  cardBody: {
    padding: 14,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTitleBox: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cardDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  badge: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  activeBadge: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  expiredBadge: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  audienceText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cardButton: {
    flex: 1,
    minHeight: 40,
  },
  cardButtonText: {
    fontSize: 13,
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: 13,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default ManageAnnouncementsScreen;
