import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import InputField from './InputField';
import colors from '../theme/colors';

const onlineProviders = ['Google Pay', 'Apple Pay', 'PayPal'];

const emptyCardDetails = {
  cardNumber: '',
  expiryDate: '',
  cvv: '',
  nameOnCard: '',
};

const emptyOnlineDetails = {
  provider: 'Google Pay',
  account: '',
};

const formatExpiryDate = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const isCardPaymentValid = (cardDetails) => {
  const cardNumber = cardDetails.cardNumber.replace(/\D/g, '');
  const expiryDate = cardDetails.expiryDate.trim();
  const cvv = cardDetails.cvv.replace(/\D/g, '');
  const nameOnCard = cardDetails.nameOnCard.trim();

  return (
    cardNumber.length === 16 &&
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryDate) &&
    cvv.length === 3 &&
    Boolean(nameOnCard)
  );
};

const isOnlinePaymentValid = (onlineDetails) =>
  Boolean(onlineDetails.provider) && Boolean(onlineDetails.account.trim());

const isMockPaymentValid = (paymentMethod, cardDetails, onlineDetails) => {
  if (paymentMethod === 'Card') {
    return isCardPaymentValid(cardDetails);
  }

  if (paymentMethod === 'Online') {
    return isOnlinePaymentValid(onlineDetails);
  }

  return true;
};

const MockPaymentForm = ({
  paymentMethod,
  cardDetails,
  onlineDetails,
  onCardDetailsChange,
  onOnlineDetailsChange,
}) => {
  const updateCardDetails = (field, value) => {
    let nextValue = value;

    if (field === 'cardNumber') {
      nextValue = value.replace(/\D/g, '').slice(0, 16);
    }

    if (field === 'expiryDate') {
      nextValue = formatExpiryDate(value);
    }

    if (field === 'cvv') {
      nextValue = value.replace(/\D/g, '').slice(0, 3);
    }

    onCardDetailsChange({
      ...cardDetails,
      [field]: nextValue,
    });
  };

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
          value={onlineDetails.account}
          onChangeText={(value) => updateOnlineDetails('account', value)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {!isOnlinePaymentValid(onlineDetails) ? (
          <Text style={styles.validationText}>Select a provider and enter an email or phone number.</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.formPanel}>
      <Text style={styles.formTitle}>Card Details</Text>
      <Text style={styles.inputLabel}>Card Number</Text>
      <InputField
        placeholder="16 digit card number"
        value={cardDetails.cardNumber}
        onChangeText={(value) => updateCardDetails('cardNumber', value)}
        keyboardType="numeric"
        maxLength={16}
      />
      <View style={styles.splitRow}>
        <View style={styles.splitItem}>
          <Text style={styles.inputLabel}>Expiry Date</Text>
          <InputField
            placeholder="MM/YY"
            value={cardDetails.expiryDate}
            onChangeText={(value) => updateCardDetails('expiryDate', value)}
            keyboardType="numeric"
            maxLength={5}
          />
        </View>
        <View style={styles.splitItem}>
          <Text style={styles.inputLabel}>CVV</Text>
          <InputField
            placeholder="3 digits"
            value={cardDetails.cvv}
            onChangeText={(value) => updateCardDetails('cvv', value)}
            keyboardType="numeric"
            secureTextEntry
            maxLength={3}
          />
        </View>
      </View>
      <Text style={styles.inputLabel}>Name on Card</Text>
      <InputField
        placeholder="Name on card"
        value={cardDetails.nameOnCard}
        onChangeText={(value) => updateCardDetails('nameOnCard', value)}
        autoCapitalize="words"
      />
      {!isCardPaymentValid(cardDetails) ? (
        <Text style={styles.validationText}>
          Enter 16 card digits, MM/YY expiry, 3 digit CVV, and cardholder name.
        </Text>
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
  emptyCardDetails,
  emptyOnlineDetails,
  isMockPaymentValid,
};

export default MockPaymentForm;
