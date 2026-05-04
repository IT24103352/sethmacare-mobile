import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client from '../../api/client';
import CustomButton from '../../components/CustomButton';
import ErrorMessage from '../../components/ErrorMessage';
import InputField from '../../components/InputField';
import colors from '../../theme/colors';

const emptyForm = {
  title: '',
  description: '',
};

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

const getResponderName = (responder) =>
  responder?.username || responder?.email || responder?.userCode || 'Admin';

const StatusBadge = ({ value }) => {
  const toneStyle =
    value === 'Resolved'
      ? styles.resolvedBadge
      : value === 'In Progress'
        ? styles.progressBadge
        : styles.openBadge;

  return <Text style={[styles.badge, toneStyle]}>{value}</Text>;
};

const MyTicketsScreen = () => {
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingTicket, setEditingTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchTickets = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError('');

    try {
      const response = await client.get('/tickets/my');
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

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingTicket(null);
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      return 'Ticket title is required.';
    }

    if (!form.description.trim()) {
      return 'Ticket description is required.';
    }

    return '';
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
      };

      if (editingTicket) {
        await client.patch(`/tickets/my/${editingTicket._id}`, payload);
        setSuccessMessage('Ticket updated successfully.');
      } else {
        await client.post('/tickets', payload);
        setSuccessMessage('Ticket created successfully.');
      }

      resetForm();
      await fetchTickets(true);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (ticket) => {
    if (ticket.status !== 'Open') {
      setError('Tickets can only be edited while their status is Open.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setEditingTicket(ticket);
    setForm({
      title: ticket.title || '',
      description: ticket.description || '',
    });
  };

  const handleDelete = (ticket) => {
    if (ticket.status !== 'Open') {
      setError('Tickets can only be deleted while their status is Open.');
      return;
    }

    Alert.alert('Delete Ticket', `Delete "${ticket.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/tickets/my/${ticket._id}`);

            if (editingTicket?._id === ticket._id) {
              resetForm();
            }

            setSuccessMessage('Ticket deleted successfully.');
            await fetchTickets(true);
          } catch (deleteError) {
            Alert.alert('Delete Failed', getErrorMessage(deleteError));
          }
        },
      },
    ]);
  };

  const submitTitle = editingTicket ? 'Save Ticket' : 'Create Ticket';

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
          <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchTickets(true)} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Tickets</Text>
          <Text style={styles.subtitle}>{tickets.length} support requests</Text>
        </View>

        <ErrorMessage message={successMessage} type="success" />
        <ErrorMessage message={error} />

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editingTicket ? 'Edit Ticket' : 'New Ticket'}</Text>

          <Text style={styles.inputLabel}>Title</Text>
          <InputField
            placeholder="Short summary"
            value={form.title}
            onChangeText={(value) => updateField('title', value)}
            autoCapitalize="sentences"
          />

          <Text style={styles.inputLabel}>Description</Text>
          <InputField
            placeholder="Describe the issue or request"
            value={form.description}
            onChangeText={(value) => updateField('description', value)}
            autoCapitalize="sentences"
            multiline
            inputStyle={styles.descriptionInput}
          />

          <CustomButton
            title={submitTitle}
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.submitButton}
          />

          {editingTicket ? (
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
          <Text style={styles.sectionTitle}>Ticket History</Text>
        </View>

        {isLoading ? (
          <Text style={styles.emptyText}>Loading tickets...</Text>
        ) : tickets.length ? (
          tickets.map((ticket) => {
            const isOpen = ticket.status === 'Open';

            return (
              <View key={ticket._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleBox}>
                    <Text style={styles.cardTitle}>{ticket.title}</Text>
                    <Text style={styles.cardMeta}>Created {formatDateTime(ticket.createdAt)}</Text>
                  </View>
                  <StatusBadge value={ticket.status} />
                </View>

                <Text style={styles.description}>{ticket.description}</Text>

                {ticket.response ? (
                  <View style={styles.responseBox}>
                    <Text style={styles.responseLabel}>
                      Admin response from {getResponderName(ticket.respondedBy)}
                    </Text>
                    <Text style={styles.responseText}>{ticket.response}</Text>
                  </View>
                ) : (
                  <Text style={styles.noResponseText}>No admin response yet.</Text>
                )}

                {isOpen ? (
                  <View style={styles.cardActions}>
                    <CustomButton
                      title="Edit"
                      type="secondary"
                      onPress={() => handleEdit(ticket)}
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
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No tickets created yet.</Text>
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
    minHeight: 96,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 4,
  },
  secondaryAction: {
    marginTop: 10,
  },
  listHeader: {
    marginBottom: 10,
    marginTop: 20,
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
});

export default MyTicketsScreen;
