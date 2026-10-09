export type AnalyticsDateRangeKey =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'custom';

export interface KpiMetric {
  value: number;
  previous: number;
  growth_pct: number;
}

export interface AnalyticsOverview {
  store_views: KpiMetric;
  unique_visitors: KpiMetric;
  orders: KpiMetric;
  sales: KpiMetric;
  new_customers: KpiMetric;
  returning_customers: KpiMetric;
  comparison_label: string;
}

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  pct_of_total: number;
}

export interface StorePerformanceFunnel {
  store_views: number;
  unique_visitors: number;
  avg_time_formatted: string;
  avg_time_seconds: number;
  product_views: number;
  add_to_cart: number;
  orders: number;
  conversion_rate_pct: number;
  steps: FunnelStep[];
  funnel_note: string;
}

export interface SearchQueryItem {
  query: string;
  normalized_query: string;
  count: number;
  unique_users: number;
  is_available: boolean;
  trend: 'up' | 'down' | 'stable';
  trend_pct: string;
  views: number;
  carts: number;
  orders: number;
}

export interface MissedDemandItem {
  query: string;
  searches: number;
  unique_users: number;
  opportunity_text: string;
  suggestion_text: string;
  cta: string;
}

export interface SearchAnalyticsData {
  searches: SearchQueryItem[];
  missed_demand: MissedDemandItem[];
}

export interface ProductMetricItem {
  id: number;
  name: string;
  image_url?: string | null;
  price: number;
  category_id?: number | null;
  category_name?: string | null;
  status_badge?: string;
  is_available: boolean;
  orders: number;
  units_sold: number;
  revenue: number;
  views: number;
  add_to_cart: number;
  conversion_rate_pct: number;
  sales_share_pct: number;
  growth_pct: number;
  insight_note?: string;
}

export interface ProductMatrixSection {
  title: string;
  description: string;
  badge: string;
  color: string;
  items: ProductMetricItem[];
}

export interface ProductMatrixData {
  star_products: ProductMatrixSection;
  needs_attention: ProductMatrixSection;
  hidden_performers: ProductMatrixSection;
  low_activity: ProductMatrixSection;
  thresholds: {
    views_threshold: number;
    orders_threshold: number;
  };
}

export interface CustomerActivityData {
  total_visitors: number;
  new_customers: number;
  returning_customers: number;
  total_customers: number;
  repeat_purchase_rate_pct: number;
  chart_distribution: {
    label: string;
    count: number;
    color: string;
  }[];
}

export interface HourlyActivityItem {
  hour: number;
  label: string;
  views: number;
  orders: number;
}

export interface CustomerEngagementData {
  avg_store_time_seconds: number;
  avg_store_time_formatted: string;
  avg_product_time_seconds: number;
  avg_product_time_formatted: string;
  peak_activity_window: string;
  hourly_activity: HourlyActivityItem[];
}

export interface BuildingAnalyticsItem {
  building_id: number;
  name: string;
  address?: string;
  store_views: number;
  orders: number;
  sales: number;
  new_customers: number;
  avg_order_value?: number;
  conversion_rate_pct?: number;
}

export interface StoreClosureImpact {
  has_impact: boolean;
  is_currently_closed: boolean;
  missed_visits: number;
  missed_orders_estimate: number;
  avg_order_value: number;
  estimated_missed_revenue: number;
  headline: string;
  message: string;
}

export interface BuildingOpportunityItem {
  building_id: number;
  name: string;
  deskdrop_users: number;
  store_views: number;
  orders: number;
  message: string;
  cta: string;
}

export interface DailySalesPoint {
  date: string;
  label: string;
  sales: number;
  orders: number;
}

export interface SalesOverviewData {
  total_sales: number;
  orders: number;
  average_order_value: number;
  growth_pct: number;
  daily_points: DailySalesPoint[];
}

export interface DemandTrendItem {
  id: number;
  name: string;
  orders_growth_pct: number;
  search_growth_pct: number;
  label: string;
  color: string;
}

export interface DemandTrendsData {
  growing: DemandTrendItem[];
  declining: DemandTrendItem[];
}

export interface SmartInsightItem {
  type: string;
  icon: string;
  title: string;
  description: string;
}

export interface ActionRecommendationItem {
  key: string;
  title: string;
  description: string;
  action_label: string;
  action_tab: string;
  product_id?: number;
}

export interface TodaySoFarData {
  store_views: number;
  product_views: number;
  orders: number;
  sales: number;
  customers: number;
  last_updated_human: string;
}

export interface VendorBusinessInsights {
  date_range: {
    key: string;
    label: string;
    start_date: string;
    end_date: string;
    comparison_label: string;
  };
  today_so_far: TodaySoFarData;
  overview: AnalyticsOverview;
  store_performance: StorePerformanceFunnel;
  search_analytics: SearchAnalyticsData;
  store_closure_impact?: StoreClosureImpact;
  top_products: ProductMetricItem[];
  most_viewed_products: ProductMetricItem[];
  most_purchased_products: ProductMetricItem[];
  all_products?: ProductMetricItem[];
  available_categories?: Array<{ id: number; name: string }>;
  product_matrix: ProductMatrixData;
  customer_activity: CustomerActivityData;
  customer_engagement: CustomerEngagementData;
  building_analytics: BuildingAnalyticsItem[];
  building_opportunities: BuildingOpportunityItem[];
  sales_overview: SalesOverviewData;
  demand_trends: DemandTrendsData;
  smart_insights: SmartInsightItem[];
  recommendations: ActionRecommendationItem[];
  generated_at: string;
}

export interface WeeklyReportData {
  title: string;
  period_label: string;
  total_orders: number;
  total_sales: number;
  new_customers: number;
  returning_customers: number;
  store_views: number;
  product_views: number;
  top_product: string;
  most_searched_product: string;
  best_building: string;
  peak_order_time: string;
  conversion_rate_pct: number;
  sales_growth_pct: number;
  key_insights: SmartInsightItem[];
  suggested_actions: ActionRecommendationItem[];
  generated_at: string;
}
