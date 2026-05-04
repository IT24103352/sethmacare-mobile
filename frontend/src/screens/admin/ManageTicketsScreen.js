import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import InputField from '../../components/InputField';
import colors from '../../theme/colors';

const statusOptions = ['In Progress', 'Resolved'];

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Unable to manage tickets.';

const formatDateTime = (value) => {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleString();
};

const getUserDisplay = (user) => {
  if (!user) {
    return 'Unknown user';
  }

  const name = user.username || user.email || user.userCode || 'User';
  return user.role ? `${name} (${user.role})` : name;
};

const StatusBadge = ({ value }) => {
  const toneStyle =
    value === 'Resolved'
      ? styles.resolvedBadge
      : value === 'In Progress'
        ? styles.progressBadge
        : styles.openBadge;

  return <Text style={[styles.badge, toneStyle]}>{value}</Text>;
};

const ManageTicketsScreen = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [responseForm, setResponseForm] = useState({
    response: '',
    status: 'In Progress',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchTickets = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/tickets/admin');
      setTickets(response.data.tickets || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
    }, [fetchTickets])
  );

  const openResponseModal = (ticket) => {
    setSelectedTicket(ticket);
    setModalError('');
    setResponseForm({
      response: ticket.response || '',
      status: ticket.status === 'Resolved' ? 'Resolved' : 'In Progress',
    });
  };

  const closeResponseModal = () => {
    if (isSubmitting) {
      return;
    }

    setSelectedTicket(null);
    setModalError('');
  };

  const updateResponseField = (field, value) => {
    setResponseForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmitResponse = async () => {
    setModalError('');
    setSuccessMessage('');

    if (!responseForm.response.trim()) {
      setModalError('Response is required.');
      return;
    }

    if (!statusOptions.includes(responseForm.status)) {
      setModalError('Select In Progress or Resolved.');
      return;
    }

    setIsSubmitting(true);

    try {
      await client.patch(`/tickets/admin/${selectedTicket._id}/respond`, {
        response: responseForm.response.trim(),
        status: responseForm.status,
      });

      setSelectedTicket(null);
      setSuccessMessage('Ticket response saved successfully.');
      await fetchTickets(true);
    } catch (submitError) {
      setModalError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (ticket) => {
    Alert.alert('Delete Ticket', `Delete "${ticket.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/tickets/admin/${ticket._id}`);
            setSuccessMessage('Ticket deleted successfully.');
            await fetchTickets(true);
          } catch (deleteError) {
            Alert.alert('Delete Failed', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchTickets(true)} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Manage Tickets</Text>
          <Text style={styles.subtitle}>{tickets.length} support requests</Text>
        </View>

        <ErrorMessage message={successMessage} type="success" />
        <ErrorMessage message={error} />

        {isLoading ? (
          <Text style={styles.emptyText}>Loading tickets...</Text>
        ) : tickets.length ? (
          tickets.map((ticket) => (
            <View key={ticket._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleBox}>
                  <Text style={styles.cardTitle}>{ticket.title}</Text>
                  <Text style={styles.cardMeta}>
                    {getUserDisplay(ticket.createdBy)} | {formatDateTime(ticket.createdAt)}
                  </Text>
                </View>
                <StatusBadge value={ticket.status} />
              </View>

              <Text style={styles.description}>{ticket.description}</Text>

              {ticket.response ? (
                <View style={styles.responseBox}>
                  <Text style={styles.responseLabel}>
                    Response by {getUserDisplay(ticket.respondedBy)}
                  </Text>
                  <Text style={styles.responseText}>{ticket.response}</Text>
                </View>
              ) : (
                <Text style={styles.noResponseText}>No response has been sent yet.</Text>
              )}

              <View style={styles.cardActions}>
                <CustomButton
                  title="Reply/Update"
                  onPress={() => openResponseModal(ticket)}
                  style={styles.cardButton}
                  textStyle={styles.cardButtonText}
                />
                <CustomButton
                  title="Delete"
                  type="secondary"
                  onPress={() => handleDelete(ticket)}
                  style={styles.cardButton}
                  textStyle={styles.deleteButtonText}
                />
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No support tickets found.</Text>
        )}
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={Boolean(selectedTicket)}
        onRequestClose={closeResponseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reply/Update Ticket</Text>
            <Text style={styles.modalSubtitle}>{selectedTicket?.title}</Text>

            <ErrorMessage message={modalError} />

            <Text style={styles.inputLabel}>Status</Text>
            <View style={styles.optionGrid}>
              {statusOptions.map((status) => {
                const isSelected = responseForm.status === status;

                return (
                  <TouchableOpacity
                    key={status}
                    activeOpacity={0.82}
                    onPress={() => updateResponseField('status', status)}
                    style={[styles.optionButton, isSelected && styles.selectedOption]}
                  >
                    <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>
                      {status}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Response</Text>
            <InputField
              placeholder="Write a response for the user"
              value={responseForm.response}
              onChangeText={(value) => updateResponseField('response', value)}
              autoCapitalize="sentences"
              multiline
              inputStyle={styles.modalResponseInput}
            />

            <CustomButton
              title="Save Response"
              onPress={handleSubmitResponse}
              loading={isSubmitting}
              style={styles.modalButton}
            />
            <CustomButton
              title="Cancel"
              type="secondary"
              onPress={closeResponseModal}
              disabled={isSubmitting}
              style={styles.modalSecondaryButton}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
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
  cardMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  openBadge: {
    backgroundColor: colors.infoBackground,
    color: colors.info,
  },
  progressBadge: {
    backgroundColor: colors.warningBackground,
    color: colors.warning,
  },
  resolvedBadge: {
    backgroundColor: colors.successBackground,
    color: colors.success,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  responseBox: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  responseLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },
  responseText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  noResponseText: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 12,
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
    marginTop: 10,
    textAlign: 'center',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 520,
    padding: 16,
    width: '100%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
    marginTop: 5,
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
    backgroundColor: colors.inputBackground,
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
  modalResponseInput: {
    minHeight: 116,
    textAlignVertical: 'top',
  },
  modalButton: {
    marginTop: 4,
  },
  modalSecondaryButton: {
    marginTop: 10,
  },
});

export default ManageTicketsScreen;
