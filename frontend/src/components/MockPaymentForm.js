import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import InputField from './InputField';
import colors from '../theme/colors';

const onlineProviders = ['Google Pay', 'Apple Pay', 'PayPal'];
const CARD_NUMBER_REGEX = /^\d{16}$/;
const CVV_REGEX = /^\d{3}$/;
const EXPIRY_DATE_REGEX = /^(0[1-9]|1[0-2])\/\d{2}$/;
const EXPIRY_FORMAT_REGEX = /^\d{2}\/\d{2}$/;
const CARD_NAME_REGEX = /^[a-zA-Z\s]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

const emptyCardDetails = {
  cardNumber: '',
  expiryDate: '',
  cvv: '',
  nameOnCard: '',
};

const emptyOnlineDetails = {
  provider: 'Google Pay',
  contactInfo: '',
};

const formatExpiryDate = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const getOnlineContactInfo = (onlineDetails) =>
  (onlineDetails.contactInfo ?? onlineDetails.account ?? '').trim();

const getCardPaymentValidationError = (cardDetails) => {
  const cardNumber = cardDetails.cardNumber.replace(/\D/g, '');
  const expiryDate = cardDetails.expiryDate.trim();
  const cvv = cardDetails.cvv.replace(/\D/g, '');
  const nameOnCard = cardDetails.nameOnCard.trim();

  if (!CARD_NUMBER_REGEX.test(cardNumber)) {
    return 'Card number must be exactly 16 digits.';
  }

  if (!expiryDate) {
    return 'Expiry date is required.';
  }

  if (!EXPIRY_FORMAT_REGEX.test(expiryDate)) {
    return 'Expiry date must use MM/YY format.';
  }

  if (!EXPIRY_DATE_REGEX.test(expiryDate)) {
    return 'Invalid expiry month. Use 01 to 12.';
  }

  if (!CVV_REGEX.test(cvv)) {
    return 'CVV must be exactly 3 digits.';
  }

  if (!nameOnCard) {
    return 'Name on card is required.';
  }

  if (!CARD_NAME_REGEX.test(nameOnCard)) {
    return 'Name cannot contain numbers or symbols.';
  }

  return '';
};

const getOnlinePaymentValidationError = (onlineDetails) => {
  const provider = onlineDetails.provider?.trim();
  const contactInfo = getOnlineContactInfo(onlineDetails);

  if (!provider) {
    return 'Select an online payment provider.';
  }

  if (!contactInfo) {
    return 'Enter the email or 10-digit phone number linked to your provider.';
  }

  if (!EMAIL_REGEX.test(contactInfo) && !PHONE_REGEX.test(contactInfo)) {
    return 'Enter a valid email address or 10-digit phone number.';
  }

  return '';
};

const getMockPaymentValidationError = (paymentMethod, cardDetails, onlineDetails) => {
  if (paymentMethod === 'Card') {
    return getCardPaymentValidationError(cardDetails);
  }

  if (paymentMethod === 'Online') {
    return getOnlinePaymentValidationError(onlineDetails);
  }

  return '';
};

const isMockPaymentValid = (paymentMethod, cardDetails, onlineDetails) => {
  return !getMockPaymentValidationError(paymentMethod, cardDetails, onlineDetails);
};

const buildMockPaymentDetails = (paymentMethod, cardDetails, onlineDetails) => {
  if (paymentMethod === 'Card') {
    return {
      cardHolderName: cardDetails.nameOnCard.trim().replace(/\s+/g, ' '),
    };
  }

  if (paymentMethod === 'Online') {
    return {
      provider: onlineDetails.provider?.trim() || '',
      contactInfo: getOnlineContactInfo(onlineDetails),
    };
  }

  return {};
};

const MockPaymentForm = ({
  paymentMethod,
  cardDetails,
  onlineDetails,
  onCardDetailsChange,
  onOnlineDetailsChange,
}) => {
  const updateOnlineDetails = (field, value) => {
    onOnlineDetailsChange({
      ...onlineDetails,
      [field]: value,
    });
  };

  if (paymentMethod === 'Cash') {
    return (
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Cash Payment</Text>
        <Text style={styles.noticeText}>No additional details are required for cash payments.</Text>
      </View>
    );
  }

  if (paymentMethod === 'Online') {
    const validationError = getOnlinePaymentValidationError(onlineDetails);

    return (
      <View style={styles.formPanel}>
        <Text style={styles.formTitle}>Online Payment Provider</Text>
        <View style={styles.providerRow}>
          {onlineProviders.map((provider) => {
            const isSelected = onlineDetails.provider === provider;

            return (
              <TouchableOpacity
                key={provider}
                activeOpacity={0.82}
                onPress={() => updateOnlineDetails('provider', provider)}
                style={[styles.providerButton, isSelected && styles.selectedProviderButton]}
              >
                <Text style={[styles.providerText, isSelected && styles.selectedProviderText]}>
                  {provider}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.inputLabel}>Email or Phone Number</Text>
        <InputField
          placeholder="Email or phone linked to provider"
          value={getOnlineContactInfo(onlineDetails)}
          onChangeText={(value) => updateOnlineDetails('contactInfo', value)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {validationError ? (
          <Text style={styles.validationText}>{validationError}</Text>
        ) : null}
      </View>
    );
  }

  const validationError = getCardPaymentValidationError(cardDetails);

  return (
    <View style={styles.formPanel}>
      <Text style={styles.formTitle}>Card Details</Text>
      <Text style={styles.inputLabel}>Card Number</Text>
      <InputField
        placeholder="16 digit card number"
        value={cardDetails.cardNumber}
        keyboardType="numeric"
        maxLength={16}
        onChangeText={(text) =>
          onCardDetailsChange({
            ...cardDetails,
            cardNumber: text.replace(/\D/g, '').slice(0, 16),
          })
        }
      />
      <View style={styles.splitRow}>
        <View style={styles.splitItem}>
          <Text style={styles.inputLabel}>Expiry Date</Text>
          <InputField
            placeholder="MM/YY"
            value={cardDetails.expiryDate}
            keyboardType="numeric"
            maxLength={5}
            onChangeText={(text) =>
              onCardDetailsChange({
                ...cardDetails,
                expiryDate: formatExpiryDate(text),
              })
            }
          />
        </View>
        <View style={styles.splitItem}>
          <Text style={styles.inputLabel}>CVV</Text>
          <InputField
            placeholder="3 digits"
            value={cardDetails.cvv}
            keyboardType="numeric"
            maxLength={3}
            secureTextEntry
            onChangeText={(text) =>
              onCardDetailsChange({
                ...cardDetails,
                cvv: text.replace(/\D/g, '').slice(0, 3),
              })
            }
          />
        </View>
      </View>
      <Text style={styles.inputLabel}>Name on Card</Text>
      <InputField
        placeholder="Name on card"
        value={cardDetails.nameOnCard}
        autoCapitalize="words"
        onChangeText={(text) =>
          onCardDetailsChange({
            ...cardDetails,
            nameOnCard: text.replace(/[^a-zA-Z\s]/g, ''),
          })
        }
      />
      {validationError ? (
        <Text style={styles.validationText}>{validationError}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  noticeBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  formPanel: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 12,
  },
  formTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  inputLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 7,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  splitItem: {
    flex: 1,
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  providerButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectedProviderButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  providerText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  selectedProviderText: {
    color: colors.white,
  },
  validationText: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
  },
});

export {
  buildMockPaymentDetails,
  emptyCardDetails,
  emptyOnlineDetails,
  getMockPaymentValidationError,
  isMockPaymentValid,
};

export default MockPaymentForm;
