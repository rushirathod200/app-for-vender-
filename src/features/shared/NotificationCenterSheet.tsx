import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppNotification } from '../../types/notification';
import { formatRelativeTime } from '../../utils/vendor';

interface NotificationCenterSheetProps {
  accentColor: string;
  visible: boolean;
  title: string;
  subtitle: string;
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onSelectNotification: (notification: AppNotification) => void;
}

export function NotificationCenterSheet({
  accentColor,
  visible,
  title,
  subtitle,
  notifications,
  unreadCount,
  isLoading,
  onClose,
  onRefresh,
  onSelectNotification,
}: NotificationCenterSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {unreadCount > 0 ? `${unreadCount} unread` : subtitle}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                style={[styles.iconButton, { backgroundColor: `${accentColor}14` }]}
                onPress={onRefresh}
              >
                <Ionicons name="refresh-outline" size={18} color={accentColor} />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={onClose}>
                <Ionicons name="close" size={18} color="#75757e" />
              </Pressable>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {isLoading ? <Text style={styles.helperText}>Loading notifications...</Text> : null}

            {!isLoading && notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={24} color="#9a9aa3" />
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptyText}>Order updates will show up here when something changes.</Text>
              </View>
            ) : null}

            {notifications.map((notification) => (
              <Pressable
                key={notification.id}
                style={[
                  styles.card,
                  !notification.is_read ? { borderColor: `${accentColor}44`, backgroundColor: `${accentColor}10` } : null,
                ]}
                onPress={() => onSelectNotification(notification)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <View
                      style={[
                        styles.readDot,
                        { backgroundColor: notification.is_read ? '#d4d4da' : accentColor },
                      ]}
                    />
                    <Text style={styles.cardTitle}>{notification.title}</Text>
                  </View>

                  {!notification.is_read ? (
                    <Text style={[styles.badge, { color: accentColor, backgroundColor: `${accentColor}14` }]}>NEW</Text>
                  ) : null}
                </View>

                {notification.description ? <Text style={styles.cardDescription}>{notification.description}</Text> : null}

                <View style={styles.cardFooter}>
                  <Text style={styles.cardTime}>{formatRelativeTime(notification.created_at)}</Text>
                  <Text style={[styles.cardAction, { color: accentColor }]}>Open</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(14,16,23,0.52)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: '#f8f8f9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: '#222329',
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    color: '#80808a',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ececef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 14,
    gap: 10,
  },
  helperText: {
    color: '#7f7f89',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e9e9ee',
    backgroundColor: '#f2f2f5',
    paddingVertical: 24,
    paddingHorizontal: 18,
  },
  emptyTitle: {
    color: '#2c2c31',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    color: '#8c8c95',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ededf2',
    backgroundColor: '#f7f7f8',
    padding: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  cardTitle: {
    flex: 1,
    color: '#212127',
    fontSize: 14,
    fontWeight: '800',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
  },
  cardDescription: {
    color: '#61616a',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTime: {
    color: '#9b9ba4',
    fontSize: 11,
    fontWeight: '700',
  },
  cardAction: {
    fontSize: 12,
    fontWeight: '800',
  },
});
