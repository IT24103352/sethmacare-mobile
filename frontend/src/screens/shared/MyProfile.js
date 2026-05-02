import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import InputField from '../../components/InputField';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const genderOptions = ['Male', 'Female', 'Other', 'Prefer not to say'];

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to update profile.';

const getSalaryErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to load salary history.';

const normalizeDate = (value) => {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
};

const parseProfileDate = (value) => {
  const normalizedValue = normalizeDate(value);

  if (!normalizedValue) {
    return new Date(1990, 0, 1);
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? new Date(1990, 0, 1) : parsedDate;
};

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDisplayValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return 'Not set';
  }

  return value;
};

const formatCurrency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getImageUrl = (relativeUrl) => {
  if (!relativeUrl) {
    return null;
  }

  if (relativeUrl.startsWith('http')) {
    return relativeUrl;
  }

  return `${client.defaults.baseURL.replace(/\/api$/, '')}${relativeUrl}`;
};

const getInitials = (value) => {
  if (!value) {
    return 'SC';
  }

  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

const ReadOnlyField = ({ label, value, wide = false, sx }) => (
  <View style={[sx.fieldCard, wide && sx.wideField]}>
    <Text style={sx.fieldLabel}>{label}</Text>
    <Text style={sx.fieldValue}>{getDisplayValue(value)}</Text>
  </View>
);

const LockedField = ({ label, value, sx }) => (
  <View style={sx.lockedField}>
    <Text style={sx.inputLabel}>{label}</Text>
    <Text style={sx.lockedValue}>{getDisplayValue(value)}</Text>
  </View>
);

const SalaryRow = ({ salary, sx }) => (
  <View style={sx.salaryRow}>
    <View style={sx.salaryMain}>
      <Text style={sx.salaryMonth}>{salary.month}</Text>
      <Text style={sx.salaryMeta}>
        {salary.roleSnapshot || 'Staff'} salary
      </Text>
    </View>
    <View style={sx.salaryAmountBox}>
      <Text style={sx.salaryAmount}>{formatCurrency(salary.amount)}</Text>
      <Text
        style={[
          sx.salaryStatus,
          salary.status === 'Paid' ? sx.salaryPaid : sx.salaryPending,
        ]}
      >
        {salary.status}
      </Text>
    </View>
  </View>
);

const MyProfile = () => {
  const { user, updateProfile, checkToken } = useAuth();
  const { colors, theme, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const isDoctor = user?.role === 'Doctor';
  const isStaff = Boolean(user?.role && user.role !== 'Patient');
  const doctorSpecialization = user?.specialization || user?.doctorProfile?.specialization || '';
  const doctorConsultationFee =
    user?.consultationFee ?? user?.doctorProfile?.consultationFee ?? '';
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDobPickerVisible, setIsDobPickerVisible] = useState(false);
  const [profileImage, setProfileImage] = useState(user?.profileImage || null);
  const [salaries, setSalaries] = useState([]);
  const [isLoadingSalaries, setIsLoadingSalaries] = useState(false);
  const [salaryError, setSalaryError] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    phoneNumber: '',
    nicNumber: '',
    gender: '',
    dateOfBirth: '',
    address: '',
    specialization: '',
    consultationFee: '',
  });

  useEffect(() => {
    setProfileImage(user?.profileImage || null);
    setForm({
      phoneNumber: user?.phoneNumber || '',
      nicNumber: user?.nicNumber || user?.nic || '',
      gender: user?.gender || '',
      dateOfBirth: normalizeDate(user?.dateOfBirth || user?.dob),
      address: user?.address || '',
      specialization: doctorSpecialization,
      consultationFee:
        doctorConsultationFee === undefined || doctorConsultationFee === null
          ? ''
          : String(doctorConsultationFee),
    });
  }, [doctorConsultationFee, doctorSpecialization, user]);

  useEffect(() => {
    let isMounted = true;

    const fetchSalaryHistory = async () => {
      if (!isStaff) {
        setSalaries([]);
        setSalaryError('');
        setIsLoadingSalaries(false);
        return;
      }

      setIsLoadingSalaries(true);
      setSalaryError('');

      try {
        const response = await client.get('/salaries/me');

        if (isMounted) {
          setSalaries(response.data.salaries || []);
        }
      } catch (fetchError) {
        if (isMounted) {
          setSalaryError(getSalaryErrorMessage(fetchError));
        }
      } finally {
        if (isMounted) {
          setIsLoadingSalaries(false);
        }
      }
    };

    fetchSalaryHistory();

    return () => {
      isMounted = false;
    };
  }, [isStaff, user?._id]);

  const imageUrl = getImageUrl(profileImage?.url);
  const initials = useMemo(
    () => getInitials(user?.username || user?.email),
    [user?.email, user?.username]
  );

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      phoneNumber: user?.phoneNumber || '',
      nicNumber: user?.nicNumber || user?.nic || '',
      gender: user?.gender || '',
      dateOfBirth: normalizeDate(user?.dateOfBirth || user?.dob),
      address: user?.address || '',
      specialization: doctorSpecialization,
      consultationFee:
        doctorConsultationFee === undefined || doctorConsultationFee === null
          ? ''
          : String(doctorConsultationFee),
    });
  };

  const handleCancel = () => {
    setError('');
    setIsEditing(false);
    setIsDobPickerVisible(false);
    resetForm();
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS !== 'ios') {
      setIsDobPickerVisible(false);
    }

    if (event?.type === 'dismissed' || !selectedDate) {
      return;
    }

    updateField('dateOfBirth', formatDateInput(selectedDate));
  };

  const validateForm = () => {
    if (!isDoctor) {
      return '';
    }

    if (!form.specialization.trim()) {
      return 'Doctor specialization is required.';
    }

    const fee = Number(form.consultationFee);

    if (!form.consultationFee || Number.isNaN(fee) || fee < 0) {
      return 'Doctor consultation fee must be a valid amount.';
    }

    return '';
  };

  const handleSave = async () => {
    setError('');
    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    const payload = {
      phoneNumber: form.phoneNumber.trim(),
      nicNumber: form.nicNumber.trim(),
      gender: form.gender,
      dateOfBirth: form.dateOfBirth.trim(),
      address: form.address.trim(),
    };

    if (isDoctor) {
      payload.specialization = form.specialization.trim();
      payload.consultationFee = Number(form.consultationFee);
      payload.doctorProfile = {
        specialization: form.specialization.trim(),
        consultationFee: Number(form.consultationFee),
      };
    }

    try {
      await updateProfile(payload);
      setIsEditing(false);
      setIsDobPickerVisible(false);
      Alert.alert('Profile Updated', 'Your profile details were saved successfully.');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePickImage = async () => {
    setError('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Gallery permission is required to upload a profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    const fileName = asset.fileName || `doctor-profile-${Date.now()}.jpg`;
    const mimeType = asset.mimeType || 'image/jpeg';

    const formData = new FormData();
    formData.append('image', {
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    });

    setIsUploadingImage(true);

    try {
      const response = await client.post('/doctor/profile-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setProfileImage(response.data.image);
      await checkToken();
      Alert.alert('Upload Complete', 'Profile image updated successfully.');
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const displayNic = user?.nicNumber || user?.nic;
  const displayDateOfBirth = normalizeDate(user?.dateOfBirth || user?.dob);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.userCode}>{user?.userCode || 'User ID unavailable'}</Text>
            <Text style={styles.title}>{user?.username || 'My Profile'}</Text>
            <Text style={styles.subtitle}>{user?.role || 'SethmaCare User'}</Text>

            {isDoctor ? (
              <CustomButton
                title={imageUrl ? 'Change Profile Image' : 'Upload Profile Image'}
                type="secondary"
                onPress={handlePickImage}
                loading={isUploadingImage}
                style={styles.imageButton}
                textStyle={styles.imageButtonText}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.themePanel}>
          <View style={styles.themeCopy}>
            <Text style={styles.themeEyebrow}>Appearance</Text>
            <Text style={styles.themeTitle}>{isDark ? 'Dark mode' : 'Light mode'}</Text>
          </View>
          <View style={styles.themeToggle}>
            {['light', 'dark'].map((mode) => {
              const isSelected = theme === mode;

              return (
                <TouchableOpacity
                  key={mode}
                  activeOpacity={0.82}
                  onPress={isSelected ? undefined : toggleTheme}
                  style={[
                    styles.themeToggleOption,
                    isSelected && styles.selectedThemeToggleOption,
                  ]}
                >
                  <Text
                    style={[
                      styles.themeToggleText,
                      isSelected && styles.selectedThemeToggleText,
                    ]}
                  >
                    {mode === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.topActions}>
          {!isEditing ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsEditing(true)}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>Edit Details</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ErrorMessage message={error} />

        {!isEditing ? (
          <View style={styles.fieldGrid}>
            <ReadOnlyField label="User ID" value={user?.userCode} sx={styles} />
            <ReadOnlyField label="Username" value={user?.username} sx={styles} />
            <ReadOnlyField label="Email Address" value={user?.email} wide sx={styles} />
            <ReadOnlyField label="Role" value={user?.role} sx={styles} />
            <ReadOnlyField label="Phone Number" value={user?.phoneNumber} sx={styles} />
            <ReadOnlyField label="NIC Number" value={displayNic} sx={styles} />
            <ReadOnlyField label="Gender" value={user?.gender} sx={styles} />
            <ReadOnlyField label="Date of Birth" value={displayDateOfBirth} sx={styles} />
            {isDoctor ? (
              <>
                <ReadOnlyField label="Specialization" value={doctorSpecialization} sx={styles} />
                <ReadOnlyField
                  label="Consultation Fee"
                  value={
                    doctorConsultationFee !== ''
                      ? `Rs. ${Number(doctorConsultationFee).toLocaleString()}`
                      : ''
                  }
                  sx={styles}
                />
              </>
            ) : null}
            <ReadOnlyField label="Address" value={user?.address} wide sx={styles} />
          </View>
        ) : (
          <View style={styles.formCard}>
            <LockedField label="Username" value={user?.username} sx={styles} />
            <LockedField label="Email Address" value={user?.email} sx={styles} />
            <LockedField label="Role" value={user?.role} sx={styles} />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <InputField
              placeholder="Phone number"
              value={form.phoneNumber}
              onChangeText={(value) => updateField('phoneNumber', value)}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>NIC Number</Text>
            <InputField
              placeholder="NIC number"
              value={form.nicNumber}
              onChangeText={(value) => updateField('nicNumber', value)}
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Gender</Text>
            <View style={styles.optionGrid}>
              {genderOptions.map((option) => {
                const isSelected = form.gender === option;

                return (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.8}
                    onPress={() => updateField('gender', option)}
                    style={[styles.optionButton, isSelected && styles.selectedOption]}
                  >
                    <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Date of Birth</Text>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setIsDobPickerVisible(true)}
              style={styles.pickerField}
            >
              <Text style={[styles.pickerValue, !form.dateOfBirth && styles.placeholderText]}>
                {form.dateOfBirth || 'Select date of birth'}
              </Text>
            </TouchableOpacity>

            {isDobPickerVisible ? (
              <View style={styles.datePickerBox}>
                <DateTimePicker
                  value={parseProfileDate(form.dateOfBirth)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={handleDateChange}
                />
                {Platform.OS === 'ios' ? (
                  <CustomButton
                    title="Done"
                    type="secondary"
                    onPress={() => setIsDobPickerVisible(false)}
                    style={styles.doneButton}
                    textStyle={styles.doneButtonText}
                  />
                ) : null}
              </View>
            ) : null}

            {isDoctor ? (
              <>
                <Text style={styles.inputLabel}>Specialization</Text>
                <InputField
                  placeholder="Specialization"
                  value={form.specialization}
                  onChangeText={(value) => updateField('specialization', value)}
                  autoCapitalize="words"
                />

                <Text style={styles.inputLabel}>Consultation Fee</Text>
                <InputField
                  placeholder="Consultation fee"
                  value={form.consultationFee}
                  onChangeText={(value) => updateField('consultationFee', value)}
                  keyboardType="numeric"
                />
              </>
            ) : null}

            <Text style={styles.inputLabel}>Address</Text>
            <InputField
              placeholder="Address"
              value={form.address}
              onChangeText={(value) => updateField('address', value)}
              autoCapitalize="sentences"
              multiline
              inputStyle={styles.addressInput}
            />

            <View style={styles.formActions}>
              <CustomButton
                title="Save Changes"
                onPress={handleSave}
                loading={isSubmitting}
                style={styles.actionButton}
              />
              <CustomButton
                title="Cancel"
                type="secondary"
                onPress={handleCancel}
                disabled={isSubmitting}
                style={styles.actionButton}
              />
            </View>
          </View>
        )}

        {isStaff ? (
          <View style={styles.salarySection}>
            <Text style={styles.salaryTitle}>My Salary History</Text>
            <Text style={styles.salarySubtitle}>Monthly salary records generated by finance.</Text>
            {salaryError ? <ErrorMessage message={salaryError} /> : null}
            {isLoadingSalaries ? (
              <Text style={styles.salaryEmpty}>Loading salary history...</Text>
            ) : salaries.length ? (
              <View style={styles.salaryList}>
                {salaries.map((salary) => (
                  <SalaryRow key={salary._id} salary={salary} sx={styles} />
                ))}
              </View>
            ) : (
              <Text style={styles.salaryEmpty}>No salary records available yet.</Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors, isDark) => StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 28,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: isDark ? 0.26 : 0.12,
    shadowRadius: 24,
    elevation: 3,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderRadius: 22,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 88,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitials: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '800',
  },
  headerContent: {
    flex: 1,
  },
  userCode: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  themePanel: {
    alignItems: 'center',
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 12,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.22 : 0.1,
    shadowRadius: 18,
    elevation: 2,
  },
  themeCopy: {
    flex: 1,
  },
  themeEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  themeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },
  themeToggle: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  themeToggleOption: {
    borderRadius: 999,
    minWidth: 62,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedThemeToggleOption: {
    backgroundColor: colors.primary,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 2,
  },
  themeToggleText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  selectedThemeToggleText: {
    color: colors.white,
  },
  imageButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  imageButtonText: {
    fontSize: 13,
  },
  topActions: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  editButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldCard: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 145,
    padding: 14,
    width: '48%',
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 1,
  },
  wideField: {
    width: '100%',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  fieldValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  formCard: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: isDark ? 0.22 : 0.1,
    shadowRadius: 22,
    elevation: 2,
  },
  lockedField: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  lockedValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  optionButton: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.inputBackground,
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
  pickerField: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickerValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  placeholderText: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  datePickerBox: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    padding: Platform.OS === 'ios' ? 8 : 0,
  },
  doneButton: {
    margin: 8,
    minHeight: 38,
  },
  doneButtonText: {
    fontSize: 13,
  },
  addressInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  formActions: {
    marginTop: 4,
  },
  actionButton: {
    marginTop: 12,
  },
  salarySection: {
    backgroundColor: colors.surfaceGlass,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: isDark ? 0.22 : 0.1,
    shadowRadius: 22,
    elevation: 2,
  },
  salaryTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  salarySubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  salaryList: {
    gap: 10,
    marginTop: 12,
  },
  salaryRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
  salaryMain: {
    flex: 1,
  },
  salaryMonth: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  salaryMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  salaryAmountBox: {
    alignItems: 'flex-end',
  },
  salaryAmount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  salaryStatus: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  salaryPaid: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  salaryPending: {
    backgroundColor: colors.warningBackground,
    color: colors.warning,
  },
  salaryEmpty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
});

export default MyProfile;
